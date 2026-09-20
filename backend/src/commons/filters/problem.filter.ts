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
import { ProblemException, type ProblemDetails } from './problem.exception';

const GENERIC_TYPE = 'about:blank';

const TITLES: Record<number, string> = {
  400: 'Solicitud incorrecta',
  401: 'No autorizado',
  403: 'Acceso prohibido',
  404: 'Recurso no encontrado',
  409: 'Conflicto',
  422: 'Entidad no procesable',
  429: 'Demasiadas solicitudes',
  500: 'Error interno del servidor',
  503: 'Servicio no disponible',
};

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
    const detail =
      this.extractMessage(exception.getResponse()) ??
      (status >= 500
        ? 'Ocurrió un error inesperado en el servidor.'
        : 'La solicitud no pudo procesarse.');

    return {
      type: GENERIC_TYPE,
      title,
      status,
      detail,
      instance: request.originalUrl ?? request.url,
    };
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