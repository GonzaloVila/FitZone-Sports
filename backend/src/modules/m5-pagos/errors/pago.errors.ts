import { HttpStatus } from '@nestjs/common';
import { GENERIC_TYPE, ProblemException } from '../../../commons/filters/problem.exception';

// Los 4xx de M5 usan componentes nombrados del contrato: cada causa tiene su `type` y
// su `title` textual, y se construyen con factories para que dos causas distintas del
// mismo status no acaben reusando el texto de la otra, que seria falso.

/**
 * RF-13 / idempotencia: `POST /pagos` exige la cabecera `Idempotency-Key`. El
 * contrato la declara `about:blank` con el `title` literal.
 *
 * La validacion va en el controller (es de transporte) y el service la recibe ya
 * presente: un cobro llamado internamente genera su propia clave y no tiene por
 * que pasar por una cabecera HTTP.
 */
export function faltaIdempotencyKey(): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: 'Falta Idempotency-Key',
    status: HttpStatus.BAD_REQUEST,
    detail: 'La cabecera Idempotency-Key es obligatoria en /pagos.',
  });
}

/**
 * La pasarela rechazo el cobro. Es un resultado de negocio, no un error de
 * sistema: el pago queda persistido como RECHAZADO y se puede listar.
 *
 * El `motivo` lo trae la pasarela; el contrato lo describe como "fondos
 * insuficientes o token invalido" y con el mock es exactamente eso.
 */
export function pagoRechazado(motivo: string): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: 'Pago rechazado',
    // 402 no existe en `TITLES` porque ningun otro modulo lo usa.
    status: 402,
    detail: motivo,
  });
}

/**
 * El cliente reintento un cobro con una clave ya usada. El `type` propio es del
 * contrato (`https://fitzone.app/errores/idempotencia-repetida`).
 *
 * El `detail` NO nombra la clave repetida: la clave es opaca para el cliente y
 * ponerla en la respuesta la filtra en los logs del servidor intermediario.
 */
export function idempotenciaRepetida(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/idempotencia-repetida',
    title: 'Idempotency-Key repetida',
    status: HttpStatus.CONFLICT,
    detail: 'Ya existe un pago con esa Idempotency-Key.',
  });
}

/**
 * Una reserva que ya fue cobrada, con una clave nueva. No es idempotencia: es un
 * intento de cobrar dos veces lo mismo, y por eso tiene su propio `detail` en vez
 * de reusar el de `idempotenciaRepetida()`.
 *
 * El `type` es `about:blank` (no hay componente con `type` propio para esto en el
 * contrato) y el status es el 409 que el endpoint ya declara.
 */
export function reservaYaCobrada(reservaId: number): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: 'La reserva ya fue cobrada',
    status: HttpStatus.CONFLICT,
    detail: `La reserva ${reservaId} ya tiene un pago asociado.`,
  });
}

/**
 * RF-14: se pidio el comprobante de un pago que no esta `APROBADO`.
 *
 * El estado va en el `detail` a proposito: el contrato responde igual para
 * `PENDIENTE`, `RECHAZADO` y `ANULADO`, pero no son lo mismo (un `RECHAZADO`
 * nunca tuvo comprobante y un `ANULADO` si lo tiene, archivado) y el cliente que
 * esta por reintentar un cobro necesita distinguirlos.
 */
export function pagoNoAprobado(pagoId: number, estado: string): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: 'Pago no aprobado',
    status: HttpStatus.CONFLICT,
    detail: `El pago ${pagoId} está en estado ${estado} y no tiene comprobante.`,
  });
}

/**
 * Se intento anular un pago `RECHAZADO`. No es anulable porque nunca se cobro: no
 * hay nada que devolver ni a la pasarela ni al socio, asi que la anulacion no
 * seria un cambio de estado sino una mentira sobre el historico. Hermano de
 * `pagoNoAprobado()`: mismo 409, mismo `about:blank`, estado en el `detail`.
 */
export function pagoNoAnulable(pagoId: number, estado: string): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: 'Pago no anulable',
    status: HttpStatus.CONFLICT,
    detail: `El pago ${pagoId} está en estado ${estado} y no puede anularse.`,
  });
}
