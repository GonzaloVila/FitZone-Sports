import type { EstadoCancha, EstadoReserva, TipoCancha } from './services/servicioCanchas'

export const TIPOS_CANCHA: TipoCancha[] = ['PADDLE', 'FUTBOL5']
export const ESTADOS_CANCHA: EstadoCancha[] = ['OPERATIVA', 'EN_MANTENIMIENTO']
export const ESTADOS_RESERVA: EstadoReserva[] = ['CONFIRMADA', 'CANCELADA', 'CUMPLIDA']

export const ETIQUETA_TIPO_CANCHA: Record<TipoCancha, string> = {
  PADDLE: 'Paddle',
  FUTBOL5: 'Fútbol 5',
}

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

export type EstadoTurno = 'libre' | 'ocupado' | 'mantenimiento' | 'pasado'

export function estadoDeTurno(
  turno: { fechaHoraInicio: string; fechaHoraFin: string; disponible: boolean },
  mantenimiento: boolean,
  reservas: Array<{ fechaHoraInicio: string; fechaHoraFin: string }>,
  ahora: Date = new Date(),
): EstadoTurno {
  const inicio = new Date(turno.fechaHoraInicio).getTime()
  const fin = new Date(turno.fechaHoraFin).getTime()
  if (inicio <= ahora.getTime()) return 'pasado'
  if (!mantenimiento) return turno.disponible ? 'libre' : 'ocupado'
  const ocupado = reservas.some((reserva) => {
    const reservaInicio = new Date(reserva.fechaHoraInicio).getTime()
    const reservaFin = new Date(reserva.fechaHoraFin).getTime()
    return reservaInicio < fin && reservaFin > inicio
  })
  return ocupado ? 'ocupado' : 'mantenimiento'
}
