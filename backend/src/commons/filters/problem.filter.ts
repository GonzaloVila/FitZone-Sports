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
import { turnoOcupadoBody } from '../../modules/m4-canchas/errors/reserva.errors';
import { mapearErrorPrisma } from '../errors/prisma.mapper';
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

// ParseIntPipe lanza BadRequestException con el mensaje en STRING, no con el
// arreglo de class-validator, asi que sin esta rama el 400 de un path param
// caeria en toHttpProblem y se responderia 400. El contrato declara 422 como
// codigo de validacion en 36 de sus 47 operaciones y solo 11 declaran 400, y
// ninguna de esas 11 es por path param.
const PARAM_PARSE_DETAIL = /^Validation failed\b/;

// Unico detalle en espanol para las 422 de validacion. Compartido por la rama de
// DTO y la de path param para que las dos 422 sean indistinguibles para el
// cliente, que es lo que pide el componente ValidationError del contrato.
const DETALLE_VALIDACION = 'Uno o más campos no cumplen las reglas de validación.';

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
    // `instance` no es required en el schema Problem, pero el resto de las ramas
    // de este filtro lo mandan. Se completa aca para que las respuestas de
    // ProblemException no sean la unica que no lo trae.
    if (exception instanceof ProblemException) {
      const details = exception.getResponse() as ProblemDetails;
      return { ...details, instance: details.instance ?? this.instanceOf(request) };
    }

    if (exception instanceof HttpException) {
      if (exception.getStatus() === HttpStatus.BAD_REQUEST) {
        if (this.isValidationError(exception)) {
          return this.toValidationProblem(exception, request);
        }
        if (this.isParamParseError(exception)) {
          return this.toParamParseProblem(request);
        }
      }
      return this.toHttpProblem(exception, request);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.toPrismaProblem(exception, request);
    }

    // Red de contension para la constraint de exclusion de M4. La regla normal
    // es que PrismaReservaRepository la intercepte y devuelva TURNO_OCUPADO; si
    // alguna otra via la deja pasar, aca se traduce igual a 409 en vez de 500.
    if (mapearErrorPrisma(exception) === 'EXCLUSION') {
      return turnoOcupadoBody(this.instanceOf(request));
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
      instance: this.instanceOf(request),
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
      detail: DETALLE_VALIDACION,
      instance: this.instanceOf(request),
      errors,
    };
  }

  // El mensaje crudo de ParseIntPipe ("Validation failed (parsint is expected)")
  // queda solo en el log: en la respuesta va el mismo detalle en español que la
  // rama de DTO, porque el helper sinIngles() de los e2e prohibe filtrar texto
  // en inglés. `errors` va vacio porque un segmento de path no es un campo del
  // body: no hay nombre de campo que reportar, solo el id que no parseo.
  private toParamParseProblem(request: Request): ProblemDetails {
    this.logger.debug(
      `Path param no numerico: ${request.method} ${request.originalUrl ?? request.url}`,
    );

    return {
      type: GENERIC_TYPE,
      title: 'Error de validación',
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail: DETALLE_VALIDACION,
      instance: this.instanceOf(request),
      errors: [],
    };
  }

  private toPrismaProblem(
    exception: Prisma.PrismaClientKnownRequestError,
    request: Request,
  ): ProblemDetails {
    if (exception.code === 'P2002') {
      const target = this.metaTarget(exception).toLowerCase();
      // OJO: `unq_reserva_turno` (unique parcial) ya NO existe. Lo sustituyo
      // una constraint de exclusion que Prisma no modela (ver commons/errors/prisma.mapper),
      // asi que su violaciones no llegan por acá como P2002 sino como
      // PrismaClientUnknownRequestError (ver rama Unknown de más abajo).
      if (target.includes('idempotenciaKey')) {
        return {
          type: 'https://fitzone.app/errores/idempotencia-repetida',
          title: 'Idempotency-Key repetida',
          status: HttpStatus.CONFLICT,
          detail: 'Ya existe un pago con esa Idempotency-Key.',
          instance: this.instanceOf(request),
        };
      }
      return {
        type: GENERIC_TYPE,
        title: 'Conflicto de unicidad',
        status: HttpStatus.CONFLICT,
        detail: 'La operación intentó crear un dato duplicado.',
        instance: this.instanceOf(request),
      };
    }

    if (exception.code === 'P2025') {
      return {
        type: GENERIC_TYPE,
        title: 'Recurso no encontrado',
        status: HttpStatus.NOT_FOUND,
        detail: 'No existe el recurso solicitado.',
        instance: this.instanceOf(request),
      };
    }

    if (exception.code === 'P2003') {
      return {
        type: GENERIC_TYPE,
        title: 'Referencia inexistente',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: 'El valor referenciado en la solicitud no existe o no esta disponible.',
        instance: this.instanceOf(request),
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
      instance: this.instanceOf(request),
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

  private isParamParseError(exception: HttpException): boolean {
    const raw = this.extractMessage(exception.getResponse());
    return raw !== undefined && PARAM_PARSE_DETAIL.test(raw);
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

  private instanceOf(request: Request): string {
    return request.originalUrl ?? request.url;
  }
}
