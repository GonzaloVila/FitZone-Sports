import { HttpException, HttpStatus } from '@nestjs/common';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

export const GENERIC_TYPE = 'about:blank';

export const TITLES: Record<number, string> = {
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

export class ProblemException extends HttpException {
  constructor(details: ProblemDetails) {
    super(details, details.status);
  }
}

export function recursoNoEncontrado(detail: string): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: TITLES[HttpStatus.NOT_FOUND],
    status: HttpStatus.NOT_FOUND,
    detail,
  });
}

export function conflictoDeDominio(title: string, detail: string): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title,
    status: HttpStatus.CONFLICT,
    detail,
  });
}
