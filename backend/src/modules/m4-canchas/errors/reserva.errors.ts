import { HttpStatus } from '@nestjs/common';
import { turnoOcupadoBody } from '../../../commons/errors/turno-ocupado';
import { GENERIC_TYPE, ProblemException } from '../../../commons/filters/problem.exception';

// RN-02: el turno ya estaba tomado. El cuerpo (type, title, detail) vive en
// commons/errors/turno-ocupado porque el ProblemFilter global tambien lo usa.
export function turnoOcupado(): ProblemException {
  // `instance` lo completa el ProblemFilter si falta.
  return new ProblemException({ ...turnoOcupadoBody(''), instance: undefined });
}

export function canchaEnMantenimiento(canchaId: number): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/cancha-en-mantenimiento',
    title: 'Cancha en mantenimiento',
    status: HttpStatus.CONFLICT,
    detail: `La cancha ${canchaId} está en mantenimiento y no admite reservas nuevas (RF-12).`,
  });
}

// 409 y no 404: la reserva existe (GET la devuelve con estado CANCELADA, y RF-12
// manda conservar el historico). Lo que choca es la transicion pedida contra el
// estado actual. Mismo criterio que `EgresoDuplicado` de M2.
export function reservaYaCancelada(id: number): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/reserva-ya-cancelada',
    title: 'Reserva ya cancelada',
    status: HttpStatus.CONFLICT,
    detail: `La reserva ${id} ya estaba cancelada y no puede cancelarse de nuevo.`,
  });
}

// 409: la reserva existe y esta CONFIRMADA, pero su turno ya empezo. No es 404
// (existe) ni 422 (la forma es valida): choca la transicion contra el estado
// EFECTIVO (CUMPLIDA), que se deriva de la fecha (ver domain/reserva-estado.ts).
export function reservaPasada(id: number): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/reserva-pasada',
    title: 'Reserva ya pasada',
    status: HttpStatus.CONFLICT,
    detail: `La reserva ${id} corresponde a un turno que ya comenzó y no puede cancelarse.`,
  });
}

export function rangoHorarioInvalido(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/rango-horario-invalido',
    title: 'Rango horario inválido',
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    detail: 'fecha_hora_inicio debe ser anterior a fecha_hora_fin.',
  });
}

// 422 (datos inválidos) y no 409: la forma del pedido es válida pero el turno ya
// empezó. Reusa el 422 que el contrato ya declara, con un detail que lo explica.
export function turnoPasado(): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: 'Turno pasado',
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    detail: 'No se puede reservar un turno que ya comenzó.',
  });
}
