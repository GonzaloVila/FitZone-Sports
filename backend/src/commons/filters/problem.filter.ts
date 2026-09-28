import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import {
  GENERIC_TYPE,
  ProblemException,
  TITLES,
  type ProblemDetails,
} from './problem.exception';

// Detalle fijo para los 4xx que produce el framework. Ver resolveDetail(): el
// detalle crudo del framework viene en ingles y, en el 404, solo repite el path
// que ya viaja en `instance`.
const CLIENT_DETAILS: Record<number, string> = {
  400: 'La solicitud está mal formada: el cuerpo no es JSON válido o algún parámetro tiene un formato inválido.',
  404: 'La ruta solicitada no existe o el recurso no fue encontrado.',
};

// Formas que solo puede producir el framework. Todo lo demas se preserva:
// la app lanza ProblemException, que corta antes en toProblemBody().
const FRAMEWORK_DETAILS: RegExp[] = [
  /^Cannot (GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS|TRACE)\b/, // ruta o metodo inexistente
  /^Validation failed\b/, // ParseIntPipe
  /^Expected .+ in JSON\b/, // body-parser en Node >= 20
  /^Unexpected token\b/, // body-parser en Node < 20
  /^Unexpected end of JSON input\b/, // body-parser: body truncado
];

@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const body = this.toProblemBody(exception, request);

    response.status(body.status);
    response.setHeader('Content-Type', 'application/problem+json');
    response.end(JSON.stringify(body));
  }

  private toProblemBody(exception: unknown, request: Request): ProblemDetails {
    if (exception instanceof ProblemException) {
      return exception.getResponse() as ProblemDetails;
    }

    if (exception instanceof HttpException) {
      if (
        exception.getStatus() === HttpStatus.BAD_REQUEST &&
        this.isValidationError(exception)
      ) {
        return this.toValidationProblem(exception, request);
      }
      return this.toHttpProblem(exception, request);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.toPrismaProblem(exception, request);
    }

    return this.toInternalProblem(exception, request);
  }

  private toHttpProblem(exception: HttpException, request: Request): ProblemDetails {
    const status = exception.getStatus();
    const title = TITLES[status] ?? (status >= 500 ? TITLES[500] : 'Error de la solicitud');
    const detail = this.resolveDetail(
      status,
      this.extractMessage(exception.getResponse()),
      request,
    );

    return {
      type: GENERIC_TYPE,
      title,
      status,
      detail,
      instance: request.originalUrl ?? request.url,
    };
  }

  private resolveDetail(
    status: number,
    raw: string | undefined,
    request: Request,
  ): string {
    if (status >= 500) {
      return raw ?? 'Ocurrió un error inesperado en el servidor.';
    }

    if (raw !== undefined && this.isFrameworkDetail(raw)) {
      this.logger.debug(`Detalle original del ${status}: ${raw}`);
      return CLIENT_DETAILS[status] ?? 'La solicitud no pudo procesarse.';
    }

    // Invariante: todo 4xx de dominio se lanza como ProblemException y corta
    // antes en toProblemBody(). Un 4xx en español que llega hasta acá es una
    // excepcion de dominio todavia sin migrar, asi que se preserva el mensaje
    // y se avisa en vez de reemplazarlo por un generico.
    if (raw !== undefined) {
      this.logger.warn(
        `HttpException de dominio sin migrar a ProblemException: ${request.method} ${request.originalUrl ?? request.url} (${status}): ${raw}`,
      );
      return raw;
    }

    return CLIENT_DETAILS[status] ?? 'La solicitud no pudo procesarse.';
  }

  private isFrameworkDetail(raw: string): boolean {
    return FRAMEWORK_DETAILS.some((pattern) => pattern.test(raw));
  }

  private toValidationProblem(exception: HttpException, request: Request): ProblemDetails {
    const response = exception.getResponse() as { message?: unknown };
    const errors = Array.isArray(response.message) ? response.message : [];

    return {
      type: GENERIC_TYPE,
      title: 'Error de validación',
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail: 'Uno o más campos no cumplen las reglas de validación.',
      instance: request.originalUrl ?? request.url,
      errors,
    };
  }

  private toPrismaProblem(
    exception: Prisma.PrismaClientKnownRequestError,
    request: Request,
  ): ProblemDetails {
    if (exception.code === 'P2002') {
      const target = this.metaTarget(exception).toLowerCase();
      if (target.includes('unq_reserva_turno')) {
        return {
          type: 'https://fitzone.app/errores/turno-ocupado',
          title: 'El turno seleccionado ya fue reservado',
          status: HttpStatus.CONFLICT,
          detail: 'Otro usuario reservó el turno para esa fecha y hora antes que vos.',
          instance: request.originalUrl ?? request.url,
        };
      }
      if (target.includes('idempotencia_key')) {
        return {
          type: 'https://fitzone.app/errores/idempotencia-repetida',
          title: 'Idempotency-Key repetida',
          status: HttpStatus.CONFLICT,
          detail: 'Ya existe un pago con esa Idempotency-Key.',
          instance: request.originalUrl ?? request.url,
        };
      }
      return {
        type: GENERIC_TYPE,
        title: 'Conflicto de unicidad',
        status: HttpStatus.CONFLICT,
        detail: 'La operación intentó crear un dato duplicado.',
        instance: request.originalUrl ?? request.url,
      };
    }

    if (exception.code === 'P2025') {
      return {
        type: GENERIC_TYPE,
        title: 'Recurso no encontrado',
        status: HttpStatus.NOT_FOUND,
        detail: 'No existe el recurso solicitado.',
        instance: request.originalUrl ?? request.url,
      };
    }

    if (exception.code === 'P2003') {
      return {
        type: GENERIC_TYPE,
        title: 'Referencia inexistente',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: 'El valor referenciado en la solicitud no existe o no esta disponible.',
        instance: request.originalUrl ?? request.url,
      };
    }

    return this.toInternalProblem(exception, request);
  }

  private toInternalProblem(exception: unknown, request: Request): ProblemDetails {
    const message = exception instanceof Error ? exception.message : String(exception);
    this.logger.error(message, exception instanceof Error ? exception.stack : undefined);

    const revealDetails = process.env.NODE_ENV !== 'production';

    return {
      type: GENERIC_TYPE,
      title: 'Error interno del servidor',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: revealDetails ? message : 'Ocurrió un error inesperado en el servidor.',
      instance: request.originalUrl ?? request.url,
    };
  }

  private isValidationError(exception: HttpException): boolean {
    const response = exception.getResponse();
    return (
      typeof response === 'object' &&
      response !== null &&
      Array.isArray((response as { message?: unknown }).message)
    );
  }

  private extractMessage(response: string | object): string | undefined {
    if (typeof response === 'string') {
      return response;
    }
    const record = response as Record<string, unknown>;
    if (typeof record.message === 'string') {
      return record.message;
    }
    if (Array.isArray(record.message)) {
      return record.message.join('; ');
    }
    if (typeof record.error === 'string') {
      return record.error;
    }
    return undefined;
  }

  private metaTarget(exception: Prisma.PrismaClientKnownRequestError): string {
    const target = exception.meta?.target;
    if (typeof target === 'string') {
      return target;
    }
    if (Array.isArray(target)) {
      return target.join(',');
    }
    return '';
  }
}