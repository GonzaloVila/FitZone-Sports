import type { ReservaCancha } from './services/servicioCanchas'

export type EstadoPagoReserva = 'cargando' | 'pagada' | 'pendiente' | 'sin-dato'

export interface FilaReserva {
  reserva: ReservaCancha
  pago: EstadoPagoReserva
}
