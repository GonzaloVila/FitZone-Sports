import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../commons/filters/problem.exception';

export function cobroRechazado(motivo: string): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/cobro-rechazado',
    title: 'Cobro rechazado',
    status: HttpStatus.PAYMENT_REQUIRED,
    detail: `La pasarela rechazó el cobro de la membresía: ${motivo}`,
  });
}

export function cobroRechazadoPendiente(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/cobro-rechazado',
    title: 'Cobro rechazado',
    status: HttpStatus.PAYMENT_REQUIRED,
    detail: 'La pasarela no resolvió el cobro de la membresía.',
  });
}

// Mismo `type` que idempotenciaRepetida() de pago.errors pero con el title de este
// flujo interno: no se unifican para no cambiar el texto que ya se emite.
export function idempotenciaRepetidaEnCobroInterno(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/idempotencia-repetida',
    title: 'Idempotencia repetida',
    status: HttpStatus.CONFLICT,
    detail: 'Ya existe un pago con esa Idempotency-Key.',
  });
}
