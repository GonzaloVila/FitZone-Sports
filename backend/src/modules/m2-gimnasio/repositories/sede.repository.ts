import type { InjectionToken } from '@nestjs/common';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import type { Sede, SedeNueva } from '../entities/sede.entity';

export const SEDE_REPOSITORY: InjectionToken = 'SEDE_REPOSITORY';

export interface SedeRepository {
  listar(opciones: OpcionesPaginacion): Promise<Sede[]>;
  crear(sede: SedeNueva): Promise<Sede>;
  buscarPorId(id: number): Promise<Sede | null>;
}
