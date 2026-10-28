import type { EstadoPago } from './services/servicioPagos'

// El filtro de estado: "TODOS" no es un estado del pago sino "sin filtro" (el contrato lo pide explícito; sin `estado` el
// backend devuelve solo los aprobados). Es el valor por defecto y va primero, en el orden del filtro.
export type FiltroEstadoPago = EstadoPago | 'TODOS'
export const ESTADOS_FILTRO: FiltroEstadoPago[] = ['TODOS', 'APROBADO', 'PENDIENTE', 'RECHAZADO', 'ANULADO']
// En el orden del filtro: la penalidad de clase va al final por ser el concepto menos habitual.
export const TIPOS_CONCEPTO = ['RESERVA_CANCHA', 'MEMBRESIA', 'RESERVA_CLASE'] as const
export type TipoConcepto = (typeof TIPOS_CONCEPTO)[number]

export const ETIQUETA_ESTADO_PAGO: Record<EstadoPago, string> = {
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
}

export const ETIQUETA_FILTRO_ESTADO: Record<FiltroEstadoPago, string> = {
  TODOS: 'Todos los estados',
  ...ETIQUETA_ESTADO_PAGO,
}

export const ETIQUETA_TIPO_CONCEPTO: Record<TipoConcepto, string> = {
  RESERVA_CANCHA: 'Reserva de cancha',
  MEMBRESIA: 'Membresía',
  // Un pago con este concepto es siempre la penalidad por cancelación tardía (RF-07), no el pago de una clase.
  RESERVA_CLASE: 'Penalidad de clase',
}

export const MEDIOS_PAGO = [
  { valor: 'aprobada', etiqueta: 'Tarjeta aprobada (demo)' },
  { valor: 'rechazada', etiqueta: 'Tarjeta rechazada (demo)' },
] as const

// El valor del select es opaco: el token de la pasarela no se muestra ni queda en el DOM.
export function tokenDeMedio(valor: string): string {
  return valor === 'rechazada' ? 'tok_rechazado_demo' : 'tok_aprobado_demo'
}

const MONEDA = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

export function formatearMonto(monto: number): string {
  return MONEDA.format(monto)
}

export function formatearFechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(iso))
}

export function formatearHora(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(iso))
}

// "jueves 12 de noviembre", en la zona de la sede.
export function formatearDia(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(iso))
}

// "18:00 a 19:00".
export function rangoHorario(inicio: string, fin: string): string {
  return `${formatearHora(inicio)} a ${formatearHora(fin)}`
}
