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
  402: 'Pago requerido',
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

// ---------------------------------------------------------------------------
// M5 · Pagos (RF-13)
//
// Los 4xx de M5 usan componentes nombrados del contrato, a diferencia de M1: cada
// causa tiene su `type` y su `title` textual, y se construyen con factories como
// `turnoOcupado()` para que dos causas distintas del mismo status no acaben
// reusando el texto de la otra, que sería falso.
// ---------------------------------------------------------------------------

/**
 * RF-13 / idempotencia: `POST /pagos` exige la cabecera `Idempotency-Key`. El
 * contrato la declara `about:blank` con el `title` literal.
 *
 * La validación va en el controller (es de transporte) y el service la recibe ya
 * presente: un cobro llamado internamente —una renovación, por ejemplo— genera su
 * propia clave y no tiene por qué pasar por una cabecera HTTP.
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
 * La pasarela rechazó el cobro. Es un resultado de negocio, no un error de
 * sistema: el pago queda persistido como RECHAZADO y se puede listar.
 *
 * El `motivo` lo trae la pasarela; el contrato lo describe como "fondos
 * insuficientes o token inválido" y con el mock es exactamente eso.
 */
export function pagoRechazado(motivo: string): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: 'Pago rechazado',
    // 402 no existe en `TITLES` porque hasta ahora ningún módulo lo usaba.
    status: 402,
    detail: motivo,
  });
}

/**
 * El body llegó al service con una combinación que el `oneOf` del contrato prohíbe.
 * Es la red de seguridad interna de M5, no un caso de uso: `ConceptoUnicoConstraint`
 * corre antes en el `ValidationPipe` y devuelve 422 con el detalle de la regla
 * incumplida. Acá solo se alcanza si alguien llama a `PagosService` sin pasar por
 * el pipe, y aun así el 422 es la respuesta honesta ("datos inválidos"), no un 500.
 */
export function datosInvalidos(detail: string): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: TITLES[422],
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    detail,
  });
}

/**
 * El cliente reintentó un cobro con una clave ya usada. El `type` propio es del
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
 * de reusar el de `idempotenciaRepetida()`, que affirmaría una clave repetida
 * cuando en realidad lo que se repitió fue la reserva.
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
 * RF-14: se pidió el comprobante de un pago que no está `APROBADO`.
 *
 * El `title` es el del ejemplo de la respuesta `PagoNoAprobado` del contrato
 * ("Pago no aprobado") y el `detail` sigue la misma redacción que el de
 * `PagoNoAnulable`, que también nombra el estado concreto.
 *
 * El estado va en el `detail` a propósito: el contrato responde igual para
 * `PENDIENTE`, `RECHAZADO` y `ANULADO`, pero no son lo mismo —un `RECHAZADO`
 * nunca tuvo comprobante y un `ANULADO` sí lo tiene, archivado— y el cliente que
 * está por reintentar un cobro necesita distinguirlos.
 */
export function pagoNoAprobado(pagoId: number, estado: string): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: 'Pago no aprobado',
    status: HttpStatus.CONFLICT,
    detail: `El pago ${pagoId} está en estado ${estado} y no tiene comprobante.`,
  });
}
