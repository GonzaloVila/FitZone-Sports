import type { InjectionToken } from '@nestjs/common';
import type { Sede, SedeNueva } from '../entities/sede.entity';

export const SEDE_REPOSITORY: InjectionToken = 'SEDE_REPOSITORY';

export interface OpcionesPaginacion {
  page: number;
  perPage: number;
}

export interface SedeRepository {
  listar(opciones: OpcionesPaginacion): Promise<Sede[]>;
  crear(sede: SedeNueva): Promise<Sede>;
  buscarPorId(id: number): Promise<Sede | null>;
}
