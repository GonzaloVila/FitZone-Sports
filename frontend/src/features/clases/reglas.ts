import type { Clase } from './services/servicioClases'

const MS_HORA = 60 * 60 * 1000

// Ventana de reserva (RF-07): hasta 48 hs antes del inicio. El servidor es quien decide; esto solo anticipa el motivo.
export const HORAS_VENTANA_RESERVA = 48
// Cancelación sin cargo hasta 2 hs antes del inicio; después se cobra penalidad.
export const HORAS_SIN_PENALIDAD = 2

export const MOTIVO_VENTANA_NO_ABIERTA = 'La reserva se abre 48 hs antes'
export const MOTIVO_CLASE_COMENZADA = 'La clase ya comenzó'

export type MomentoDeClase = 'comenzada' | 'ventana-cerrada' | 'ventana-abierta'

export function momentoDeClase(clase: Pick<Clase, 'horarioInicio'>, ahora: number): MomentoDeClase {
  const inicio = new Date(clase.horarioInicio).getTime()
  if (ahora >= inicio) return 'comenzada'
  if (inicio - ahora > HORAS_VENTANA_RESERVA * MS_HORA) return 'ventana-cerrada'
  return 'ventana-abierta'
}

// Faltan menos de 2 hs (y la clase no comenzó): la cancelación tiene penalidad del 50 %.
export function cancelacionConPenalidad(clase: Pick<Clase, 'horarioInicio'>, ahora: number): boolean {
  const inicio = new Date(clase.horarioInicio).getTime()
  return ahora < inicio && inicio - ahora < HORAS_SIN_PENALIDAD * MS_HORA
}
