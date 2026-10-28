import type { EstadoCancha, EstadoReserva, TipoCancha } from './services/servicioCanchas'
import type { EstadoPagoReserva } from './tipos'

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

// Las pestañas de "Mis reservas" (cada una pide un estado al servidor; Próximas, el de por defecto: confirmadas activas).
export type PestanaReservas = 'proximas' | 'canceladas' | 'pasadas'
export const PESTANAS_RESERVAS: PestanaReservas[] = ['proximas', 'canceladas', 'pasadas']

export interface InsigniaPago {
  texto: string
  variante: 'exito' | 'advertencia' | 'neutra'
}

// La única insignia de la columna "Pago" de una reserva. La pestaña ya dice si la reserva es próxima, pasada o cancelada, así
// que acá solo se dice si está paga: en Próximas "Pagada" o "Pendiente de pago"; en Pasadas y Canceladas "Pagada" o "Sin pago".
// Null mientras no se sabe (se está consultando el pago o la consulta falló): no se afirma nada que no se sepa.
export function insigniaDePago(pago: EstadoPagoReserva, pestana: PestanaReservas): InsigniaPago | null {
  if (pago === 'pagada') return { texto: 'Pagada', variante: 'exito' }
  if (pago !== 'pendiente') return null
  return pestana === 'proximas'
    ? { texto: 'Pendiente de pago', variante: 'advertencia' }
    : { texto: 'Sin pago', variante: 'neutra' }
}

export type AccionReserva = 'pagar' | 'cancelar'

export interface AccionDeReserva {
  clave: AccionReserva
  // Se ve pero no se puede elegir todavía (se está consultando el pago).
  deshabilitada?: boolean
}

// Las acciones del menú de una reserva de Próximas: "Pagar" mientras no haya un pago aprobado (deshabilitada hasta saber si lo
// hay) y "Cancelar" si el turno todavía no empezó. Puede no haber ninguna (turno en curso y ya pagado).
export function accionesDeReserva(
  reserva: { estado: EstadoReserva; fechaHoraInicio: string },
  pago: EstadoPagoReserva,
  ahora: Date = new Date(),
): AccionDeReserva[] {
  const acciones: AccionDeReserva[] = []
  if (puedePagarse(reserva.estado) && pago !== 'pagada') {
    acciones.push(pago === 'cargando' ? { clave: 'pagar', deshabilitada: true } : { clave: 'pagar' })
  }
  if (puedeCancelarse(reserva, ahora)) acciones.push({ clave: 'cancelar' })
  return acciones
}
