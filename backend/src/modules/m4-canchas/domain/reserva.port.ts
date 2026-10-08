import type { Reserva } from '../entities/reserva.entity';

export interface ReservaNueva {
  canchaId: number;
  usuarioId: number;
  fechaHoraInicio: Date;
  fechaHoraFin: Date;
  precioAplicado: number;
}

// Resultado discriminado: el solapamiento (RN-02) solo es detectable en la
// base, por la constraint de exclusion; el adaptador lo traduce a este motivo
// y el service decide el 409 (mismo criterio que ResultadoCrearIngreso en M2).
export type ResultadoCrearReserva =
  | { ok: true; reserva: Reserva }
  | { ok: false; motivo: 'TURNO_OCUPADO' };

// Lista blanca de filtros: solo filtra por los campos presentes. El repositorio
// no decide defaults (p. ej. el estado): eso es regla de negocio del service.
// desde/hasta acotan fechaHoraInicio como [desde, hasta).
export interface FiltrosListarReservas {
  canchaId?: number;
  usuarioId?: number;
  estado?: 'CONFIRMADA' | 'CANCELADA';
  desde?: Date;
  hasta?: Date;
  page: number;
  perPage: number;
}

// Repositorio de dominio (Fowler) de la reserva de cancha. Es una abstract class y
// no una interface para que sirva de token de inyeccion de Nest sin un string
// aparte: el equivalente de `interface ReservaRepository extends JpaRepository`.
// Los services dependen de este puerto; el adaptador de Prisma se registra con
// { provide: ReservaRepository, useClass: PrismaReservaRepository }.
export abstract class ReservaRepository {
  abstract crear(reserva: ReservaNueva): Promise<ResultadoCrearReserva>;
  abstract buscarPorId(id: number): Promise<Reserva | null>;
  // null: la reserva no existe o ya estaba cancelada (otra cancelacion gano).
  abstract cancelar(id: number): Promise<Reserva | null>;
  abstract listarOcupadasEnRango(canchaId: number, desde: Date, hasta: Date): Promise<Reserva[]>;
  abstract listar(filtros: FiltrosListarReservas): Promise<Reserva[]>;
}
