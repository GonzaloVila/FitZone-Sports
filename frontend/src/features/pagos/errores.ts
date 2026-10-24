import { esErrorApi, mensajeDeError } from '@/compartido/http/errores'

export const TIPO_IDEMPOTENCIA_REPETIDA = 'https://fitzone.app/errores/idempotencia-repetida'

export function esIdempotenciaRepetida(e: unknown): boolean {
  return esErrorApi(e) && e.status === 409 && e.problema?.type === TIPO_IDEMPOTENCIA_REPETIDA
}

export function mensajePago(e: unknown): string {
  if (!esErrorApi(e)) return mensajeDeError(e, 'No se pudo procesar el pago.')
  if (e.status === 400) return 'Falta la clave de idempotencia del cobro. Recargá la página e intentá de nuevo.'
  if (e.status === 402) return 'El pago fue rechazado.'
  if (e.status === 404) return 'La reserva o el concepto a cobrar no existe.'
  if (e.status === 409) return 'Ese cobro ya fue procesado.'
  if (e.status === 422) return e.message || 'Los datos del pago no son válidos.'
  return e.message || 'No se pudo procesar el pago.'
}

export function mensajeAnulacion(e: unknown): string {
  if (!esErrorApi(e)) return mensajeDeError(e, 'No se pudo anular el pago.')
  if (e.status === 409) return `El pago no se puede anular: ${e.message}`
  return e.message || 'No se pudo anular el pago.'
}

export function mensajeDescarga(e: unknown): string {
  return mensajeDeError(e, 'No se pudo descargar el PDF.')
}
