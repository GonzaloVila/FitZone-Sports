import type { InjectionToken } from '@nestjs/common';
import type { ReservaClase } from '../entities/reserva-clase.entity';

export const RESERVA_CLASE_REPOSITORY: InjectionToken = 'RESERVA_CLASE_REPOSITORY';

export type MotivoFalloReserva = 'CUPO_AGOTADO' | 'RESERVA_DUPLICADA' | 'CLASE_INEXISTENTE';

export type ResultadoCrearReserva =
  | { ok: true; reserva: ReservaClase }
  | { ok: false; motivo: MotivoFalloReserva };

export interface ReservaClaseRepository {
  crearConLock(claseId: number, socioId: number): Promise<ResultadoCrearReserva>;
  buscarPorId(id: number): Promise<ReservaClase | null>;
  buscarActivaPorClaseYSocio(claseId: number, socioId: number): Promise<ReservaClase | null>;
  marcarCancelada(id: number): Promise<ReservaClase | null>;
  contarConfirmadasPorClase(claseId: number): Promise<number>;
}
