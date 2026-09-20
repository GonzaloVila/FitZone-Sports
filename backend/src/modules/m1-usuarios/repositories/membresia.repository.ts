import type { InjectionToken } from '@nestjs/common';
import type { Membresia, MembresiaActualizable, MembresiaNueva } from '../entities/membresia.entity';

export const MEMBRESIA_REPOSITORY: InjectionToken = 'MEMBRESIA_REPOSITORY';

export interface MembresiaRepository {
  crear(membresia: MembresiaNueva): Promise<Membresia>;
  buscarPorSocioId(socioId: number): Promise<Membresia | null>;
  actualizar(socioId: number, cambios: MembresiaActualizable): Promise<Membresia | null>;
}