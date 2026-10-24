import type { Clase, EstadoEspera, EstadoReservaClase } from './services/servicioClases'

// Cómo se muestran los valores del contrato. Record<...> obliga a actualizar esto si el contrato agrega uno.
export const ETIQUETAS_ESTADO_RESERVA: Record<EstadoReservaClase, string> = {
  CONFIRMADA: 'Confirmada',
  CANCELADA: 'Cancelada',
  CUMPLIDA: 'Cumplida',
}

export const VARIANTES_ESTADO_RESERVA: Record<EstadoReservaClase, 'exito' | 'peligro' | 'neutra'> = {
  CONFIRMADA: 'exito',
  CANCELADA: 'peligro',
  CUMPLIDA: 'neutra',
}

export const ETIQUETAS_ESTADO_ESPERA: Record<EstadoEspera, string> = {
  EN_ESPERA: 'En espera',
  NOTIFICADO: 'Cupo disponible',
  CONFIRMADO: 'Confirmado',
  CANCELADO: 'Cancelado',
}

export const VARIANTES_ESTADO_ESPERA: Record<EstadoEspera, 'neutra' | 'advertencia' | 'exito' | 'peligro'> = {
  EN_ESPERA: 'neutra',
  NOTIFICADO: 'advertencia',
  CONFIRMADO: 'exito',
  CANCELADO: 'peligro',
}

// Las fechas del contrato vienen con offset de la sede (-03:00): se muestran siempre en esa zona.
const ZONA = 'America/Argentina/Buenos_Aires'
const FORMATO_DIA = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  timeZone: ZONA,
})
const FORMATO_HORA = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA })

export function formatearDia(fechaIso: string): string {
  const fecha = new Date(fechaIso)
  return Number.isNaN(fecha.getTime()) ? fechaIso : FORMATO_DIA.format(fecha)
}

export function formatearHora(fechaIso: string): string {
  const fecha = new Date(fechaIso)
  return Number.isNaN(fecha.getTime()) ? fechaIso : FORMATO_HORA.format(fecha)
}

export function formatearHorario(clase: Pick<Clase, 'horarioInicio' | 'horarioFin'>): string {
  return `${formatearDia(clase.horarioInicio)}, ${formatearHora(clase.horarioInicio)} a ${formatearHora(clase.horarioFin)} hs`
}

const FORMATO_MONTO = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

export function formatearMonto(monto: number): string {
  return FORMATO_MONTO.format(monto)
}
