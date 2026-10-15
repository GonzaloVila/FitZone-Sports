import type { ReservaClase } from '../entities/reserva-clase.entity';

// Estado EFECTIVO de una reserva de clase (patron State, ADR-10), espejo del de la
// reserva de cancha (m4). CUMPLIDA no se persiste: se DERIVA de la fecha de fin de
// la clase. La columna `estado` solo guarda CONFIRMADA / CANCELADA.
export type EstadoReservaClaseDerivado = 'CONFIRMADA' | 'CANCELADA' | 'CUMPLIDA';

export interface EstadoDeReservaClase {
  readonly nombre: EstadoReservaClaseDerivado;
  // Solo se cancela una reserva confirmada cuya clase NO haya empezado.
  puedeCancelar(reserva: ReservaClase, ahora?: Date): boolean;
}

const CONFIRMADA: EstadoDeReservaClase = {
  nombre: 'CONFIRMADA',
  puedeCancelar: (reserva, ahora = new Date()) => ahora < reserva.horarioInicio,
};

const CANCELADA: EstadoDeReservaClase = {
  nombre: 'CANCELADA',
  puedeCancelar: () => false,
};

const CUMPLIDA: EstadoDeReservaClase = {
  nombre: 'CUMPLIDA',
  puedeCancelar: () => false,
};

// Deriva el estado efectivo: la fecha de fin de la clase es la fuente de verdad.
export function estadoDeReservaClase(
  reserva: ReservaClase,
  ahora: Date = new Date(),
): EstadoDeReservaClase {
  if (reserva.estado === 'CANCELADA') {
    return CANCELADA;
  }
  if (ahora >= reserva.horarioFin) {
    return CUMPLIDA;
  }
  return CONFIRMADA;
}
