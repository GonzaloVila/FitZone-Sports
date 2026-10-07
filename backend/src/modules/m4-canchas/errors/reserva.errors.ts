import { HttpStatus } from '@nestjs/common';
import { ProblemDetails, ProblemException } from '../../../commons/filters/problem.exception';

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

export function rangoHorarioInvalido(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/rango-horario-invalido',
    title: 'Rango horario inválido',
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    detail: 'fecha_hora_inicio debe ser anterior a fecha_hora_fin.',
  });
}
