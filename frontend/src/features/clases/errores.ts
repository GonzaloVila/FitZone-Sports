import { esErrorApi, mensajeDeError } from '@/compartido/http/errores'

// Campo `type` del problem+json: distingue dos 409 distintos sin depender del texto.
export const TIPOS_ERROR_CLASES = {
  RESERVA_ANTICIPADA: 'https://fitzone.app/errores/reserva-anticipada-no-permitida',
  CLASE_PASADA: 'https://fitzone.app/errores/clase-pasada',
  CUPO_AGOTADO: 'https://fitzone.app/errores/cupo-agotado',
  RESERVA_DUPLICADA: 'https://fitzone.app/errores/reserva-duplicada',
  CUPO_DISPONIBLE: 'https://fitzone.app/errores/cupo-disponible',
  ESPERA_EXISTENTE: 'https://fitzone.app/errores/espera-existente',
  ESPERA_CONFIRMADA: 'https://fitzone.app/errores/espera-confirmada',
  ESPERA_NO_NOTIFICADA: 'https://fitzone.app/errores/espera-no-notificada',
  CUPO_TOMADO: 'https://fitzone.app/errores/cupo-tomado',
  RESERVA_CLASE_PASADA: 'https://fitzone.app/errores/reserva-clase-pasada',
} as const

export const MENSAJE_CUOTAS_VENCIDAS =
  'Tenés cuotas vencidas, por eso no podés reservar ni anotarte en la espera de clases bonificadas. Regularizá la cuota en recepción.'

function tipoDe(e: unknown): string | undefined {
  return esErrorApi(e) ? e.problema?.type : undefined
}

export function traducirErrorReserva(e: unknown): string {
  const tipo = tipoDe(e)
  if (esErrorApi(e) && e.status === 403) return MENSAJE_CUOTAS_VENCIDAS
  if (tipo === TIPOS_ERROR_CLASES.RESERVA_ANTICIPADA) return 'La reserva se abre 48 hs antes.'
  if (tipo === TIPOS_ERROR_CLASES.CLASE_PASADA) return 'La clase ya comenzó.'
  if (tipo === TIPOS_ERROR_CLASES.CUPO_AGOTADO) {
    return 'Se agotaron los cupos mientras reservabas. Podés anotarte en la lista de espera.'
  }
  if (tipo === TIPOS_ERROR_CLASES.RESERVA_DUPLICADA) return 'Ya tenés una reserva en esta clase.'
  return mensajeDeError(e, 'No se pudo reservar el cupo.')
}

export function traducirErrorCancelacion(e: unknown): string {
  if (esErrorApi(e) && e.status === 402) return 'No se pudo cobrar la penalidad; tu reserva sigue vigente.'
  if (esErrorApi(e) && e.status === 409) return 'La clase ya comenzó.'
  return mensajeDeError(e, 'No se pudo cancelar la reserva.')
}

export function traducirErrorEspera(e: unknown): string {
  const tipo = tipoDe(e)
  if (esErrorApi(e) && e.status === 403) return MENSAJE_CUOTAS_VENCIDAS
  if (tipo === TIPOS_ERROR_CLASES.CUPO_DISPONIBLE) return 'La clase tiene cupos disponibles: podés reservar directamente.'
  if (tipo === TIPOS_ERROR_CLASES.ESPERA_EXISTENTE) return 'Ya estás anotado en la lista de espera o tenés una reserva en esta clase.'
  if (tipo === TIPOS_ERROR_CLASES.CLASE_PASADA) return 'La clase ya comenzó.'
  return mensajeDeError(e, 'No se pudo anotar en la lista de espera.')
}

export function traducirErrorConfirmacion(e: unknown): string {
  if (tipoDe(e) === TIPOS_ERROR_CLASES.CUPO_TOMADO) return 'Otro socio confirmó antes que vos.'
  if (tipoDe(e) === TIPOS_ERROR_CLASES.ESPERA_NO_NOTIFICADA) return 'Todavía no se liberó un cupo para vos.'
  return mensajeDeError(e, 'No se pudo confirmar el cupo.')
}

export function traducirErrorSalidaDeEspera(e: unknown): string {
  if (esErrorApi(e) && e.status === 409) {
    return 'Ya confirmaste el cupo: no se puede abandonar la espera. Cancelá la reserva desde "Mis clases".'
  }
  return mensajeDeError(e, 'No se pudo salir de la lista de espera.')
}
