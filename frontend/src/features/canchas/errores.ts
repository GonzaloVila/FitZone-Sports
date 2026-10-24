import { esErrorApi, mensajeDeError } from '@/compartido/http/errores'

export const TIPOS_ERROR_CANCHAS = {
  TURNO_OCUPADO: 'https://fitzone.app/errores/turno-ocupado',
  CANCHA_EN_MANTENIMIENTO: 'https://fitzone.app/errores/cancha-en-mantenimiento',
  RESERVA_YA_CANCELADA: 'https://fitzone.app/errores/reserva-ya-cancelada',
  RESERVA_PASADA: 'https://fitzone.app/errores/reserva-pasada',
  RANGO_HORARIO_INVALIDO: 'https://fitzone.app/errores/rango-horario-invalido',
} as const

function tipoDe(e: unknown): string | undefined {
  return esErrorApi(e) ? e.problema?.type : undefined
}

export function esTurnoTomado(e: unknown): boolean {
  return tipoDe(e) === TIPOS_ERROR_CANCHAS.TURNO_OCUPADO
}

export function esConflictoDeReserva(e: unknown): boolean {
  return esErrorApi(e) && e.status === 409
}

export function mensajeReserva(e: unknown): string {
  switch (tipoDe(e)) {
    case TIPOS_ERROR_CANCHAS.TURNO_OCUPADO:
      return 'Ese turno acaba de ser tomado, elegí otro.'
    case TIPOS_ERROR_CANCHAS.CANCHA_EN_MANTENIMIENTO:
      return 'La cancha está en mantenimiento y no admite reservas.'
    case TIPOS_ERROR_CANCHAS.RANGO_HORARIO_INVALIDO:
      return 'El tramo horario no es válido.'
    default:
      return mensajeDeError(e, 'No se pudo reservar el turno.')
  }
}

export function mensajeCancelacion(e: unknown): string {
  switch (tipoDe(e)) {
    case TIPOS_ERROR_CANCHAS.RESERVA_YA_CANCELADA:
      return 'La reserva ya estaba cancelada.'
    case TIPOS_ERROR_CANCHAS.RESERVA_PASADA:
      return 'El turno ya comenzó: no se puede cancelar.'
    default:
      return mensajeDeError(e, 'No se pudo cancelar la reserva.')
  }
}
