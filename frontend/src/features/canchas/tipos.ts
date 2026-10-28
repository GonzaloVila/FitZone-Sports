import type { ReservaCancha } from './services/servicioCanchas'

// Quien reservó un turno: su id y, si se pudo saber, su nombre completo (null si el pedido del nombre falló o todavía no llegó).
export interface Reservante {
  usuarioId: number
  nombre: string | null
}

export type EstadoPagoReserva = 'cargando' | 'pagada' | 'pendiente' | 'sin-dato'

export interface FilaReserva {
  reserva: ReservaCancha
  pago: EstadoPagoReserva
}

// Lo que se carga en el alta de una cancha, tal como lo entregan los campos (el costo y la sede, como texto).
export interface FormularioCanchaDatos {
  sedeId: string
  tipo: string
  costoPorHora: string
}
