import type { InjectionToken } from '@nestjs/common';
import type { Reserva } from '../entities/reserva.entity';

export const RESERVA_REPOSITORY: InjectionToken = 'RESERVA_REPOSITORY';

export interface ReservaNueva {
  cancha_id: number;
  usuario_id: number;
  fecha_hora_inicio: Date;
  fecha_hora_fin: Date;
  precio_aplicado: number;
}

// Resultado discriminado: el solapamiento (RN-02) solo es detectable en la
// base, por la constraint exq_reserva_turno; el adaptador lo traduce a este
// motivo y el service decide el 409 (mismo criterio que ResultadoCrearIngreso en M2).
export type ResultadoCrearReserva =
  | { ok: true; reserva: Reserva }
  | { ok: false; motivo: 'TURNO_OCUPADO' };

export interface ReservaRepository {
  crear(reserva: ReservaNueva): Promise<ResultadoCrearReserva>;
  buscarPorId(id: number): Promise<Reserva | null>;
  // null si no existía o ya estaba CANCELADA.
  cancelar(id: number): Promise<Reserva | null>;
  // Reservas no canceladas que se solapan con [desde, hasta).
  listarOcupadasEnRango(canchaId: number, desde: Date, hasta: Date): Promise<Reserva[]>;
}
