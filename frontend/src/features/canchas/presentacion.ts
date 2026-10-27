import type { EstadoCancha, EstadoReserva, TipoCancha } from './services/servicioCanchas'

export const ESTADOS_CANCHA: EstadoCancha[] = ['OPERATIVA', 'EN_MANTENIMIENTO']
export const ESTADOS_RESERVA: EstadoReserva[] = ['CONFIRMADA', 'CANCELADA', 'CUMPLIDA']

// ÚNICO lugar donde se escribe el nombre de un deporte. `TipoCancha` sale del contrato (api.d.ts): como el mapa es un
// Record<TipoCancha, string>, sumar un deporte al contrato rompe el type-check hasta que se le escribe el nombre acá, y
// con eso queda en el selector del alta, en el filtro de la lista, en la tabla, en los nombres accesibles y en los turnos.
export const ETIQUETA_TIPO_CANCHA: Record<TipoCancha, string> = {
  PADDLE: 'Paddle',
  FUTBOL5: 'Fútbol 5',
}

// Los deportes, en el orden del mapa de etiquetas (no hay una segunda lista que mantener).
export const TIPOS_CANCHA = Object.keys(ETIQUETA_TIPO_CANCHA) as TipoCancha[]

export const ETIQUETA_ESTADO_CANCHA: Record<EstadoCancha, string> = {
  OPERATIVA: 'Operativa',
  EN_MANTENIMIENTO: 'En mantenimiento',
}

export const ETIQUETA_ESTADO_RESERVA: Record<EstadoReserva, string> = {
  CONFIRMADA: 'Confirmada',
  CANCELADA: 'Cancelada',
  CUMPLIDA: 'Cumplida',
}

const MONEDA = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

export function formatearMonto(monto: number): string {
  return MONEDA.format(monto)
}

export const ZONA_HORARIA_SEDE = 'America/Argentina/Buenos_Aires'

export function formatearHora(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: ZONA_HORARIA_SEDE,
  }).format(new Date(iso))
}

// "jueves 12 de noviembre", en la zona de la sede.
export function formatearDia(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: ZONA_HORARIA_SEDE,
  }).format(new Date(iso))
}

export function formatearFechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: ZONA_HORARIA_SEDE,
  }).format(new Date(iso))
}

export function rangoDeTurno(inicio: string, fin: string): string {
  return `${formatearHora(inicio)} a ${formatearHora(fin)}`
}

export function fechaDeHoy(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA_SEDE }).format(new Date())
}

export function puedePagarse(estado: EstadoReserva): boolean {
  return estado === 'CONFIRMADA' || estado === 'CUMPLIDA'
}

export function puedeCancelarse(
  reserva: { estado: EstadoReserva; fechaHoraInicio: string },
  ahora: Date = new Date(),
): boolean {
  return (
    reserva.estado === 'CONFIRMADA' &&
    new Date(reserva.fechaHoraInicio).getTime() > ahora.getTime()
  )
}

export type SituacionReserva = 'proxima' | 'en-curso' | 'cumplida' | 'cancelada'

export function situacionDeReserva(
  reserva: { estado: EstadoReserva; fechaHoraInicio: string; fechaHoraFin: string },
  ahora: Date = new Date(),
): SituacionReserva {
  if (reserva.estado === 'CANCELADA') return 'cancelada'
  const instante = ahora.getTime()
  if (instante >= new Date(reserva.fechaHoraFin).getTime()) return 'cumplida'
  if (instante >= new Date(reserva.fechaHoraInicio).getTime()) return 'en-curso'
  return 'proxima'
}

export const ETIQUETA_SITUACION: Record<SituacionReserva, string> = {
  proxima: 'Próxima',
  'en-curso': 'En curso',
  cumplida: 'Cumplida',
  cancelada: 'Cancelada',
}
