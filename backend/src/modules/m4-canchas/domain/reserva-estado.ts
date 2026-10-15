import type { Reserva } from '../entities/reserva.entity';

// Estado EFECTIVO de una reserva de cancha (patron State, ADR-10). Tiene tres
// estados de negocio, pero CUMPLIDA NO se persiste: se DERIVA de la fecha (el
// turno ya termino). La columna `estado` solo guarda CONFIRMADA / CANCELADA.
//
// State decide QUE se puede hacer (cancelar); el COMO (precio) es Strategy.
// La transicion es por tiempo (sin evento ni cron): una reserva CONFIRMADA cuyo
// fin ya paso es, a los ojos del negocio, CUMPLIDA.
export type EstadoReservaDerivado = 'CONFIRMADA' | 'CANCELADA' | 'CUMPLIDA';

export interface EstadoDeReserva {
  readonly nombre: EstadoReservaDerivado;
  // Solo se cancela una reserva confirmada cuyo turno NO haya empezado.
  puedeCancelar(reserva: Reserva, ahora?: Date): boolean;
}

const CONFIRMADA: EstadoDeReserva = {
  nombre: 'CONFIRMADA',
  puedeCancelar: (reserva, ahora = new Date()) => ahora < reserva.fechaHoraInicio,
};

const CANCELADA: EstadoDeReserva = {
  nombre: 'CANCELADA',
  puedeCancelar: () => false,
};

const CUMPLIDA: EstadoDeReserva = {
  nombre: 'CUMPLIDA',
  puedeCancelar: () => false,
};

// Deriva el estado efectivo: la fecha es la fuente de verdad de CUMPLIDA.
export function estadoDeReserva(reserva: Reserva, ahora: Date = new Date()): EstadoDeReserva {
  if (reserva.estado === 'CANCELADA') {
    return CANCELADA;
  }
  if (ahora >= reserva.fechaHoraFin) {
    return CUMPLIDA;
  }
  return CONFIRMADA;
}
