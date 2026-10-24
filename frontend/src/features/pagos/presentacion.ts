import type { EstadoPago } from './services/servicioPagos'

export const ESTADOS_PAGO: EstadoPago[] = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO']
export const TIPOS_CONCEPTO = ['RESERVA_CANCHA', 'MEMBRESIA', 'RESERVA_CLASE'] as const
export type TipoConcepto = (typeof TIPOS_CONCEPTO)[number]

export const ETIQUETA_ESTADO_PAGO: Record<EstadoPago, string> = {
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
}

export const ETIQUETA_TIPO_CONCEPTO: Record<TipoConcepto, string> = {
  RESERVA_CANCHA: 'Reserva de cancha',
  MEMBRESIA: 'Membresía',
  RESERVA_CLASE: 'Reserva de clase',
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

export function rangoDeTurno(inicio: string, fin: string): string {
  return `${formatearFechaHora(inicio)} a ${formatearHora(fin)}`
}
