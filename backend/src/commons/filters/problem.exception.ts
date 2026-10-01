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

/**
 * RN-02: el turno ya estaba tomado. El `type` y el `detail` son los que declara
 * el contrato en el ejemplo `turno-ocupado` de `ConflictoReservaCancha`. Vive
 * como factory y no inline en el service para que la otra causa de 409 del
 * mismo endpoint (`cancha-en-mantenimiento`) no acabe reusando este texto, que
 * seria falso para ella: en mantenimiento no hubo concurrencia.
 */
export function turnoOcupadoBody(instance: string): ProblemDetails {
  return {
    type: 'https://fitzone.app/errores/turno-ocupado',
    title: 'El turno seleccionado ya fue reservado',
    status: HttpStatus.CONFLICT,
    detail: 'Otro usuario reservó el turno para esa fecha y hora antes que vos.',
    instance,
  };
}

export function turnoOcupado(): ProblemException {
  // `instance` lo completa el ProblemFilter si falta.
  return new ProblemException({ ...turnoOcupadoBody(''), instance: undefined });
}
