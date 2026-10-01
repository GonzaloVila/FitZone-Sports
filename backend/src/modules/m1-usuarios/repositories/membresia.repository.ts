import type { InjectionToken } from '@nestjs/common';
import type { Membresia, MembresiaActualizable } from '../entities/membresia.entity';

export const MEMBRESIA_REPOSITORY: InjectionToken = 'MEMBRESIA_REPOSITORY';

export interface MembresiaRepository {
  buscarPorSocioId(socioId: number): Promise<Membresia | null>;
  actualizar(socioId: number, cambios: MembresiaActualizable): Promise<Membresia | null>;
  /** Pasa a VENCIDA toda membresía ACTIVA con fecha_fin ya pasada. Devuelve la cantidad afectada. */
  marcarVencidas(): Promise<number>;
}