import type { InjectionToken } from '@nestjs/common';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import type { Clase, ClaseConCupo, ClaseNueva } from '../entities/clase.entity';

export const CLASE_REPOSITORY: InjectionToken = 'CLASE_REPOSITORY';

export interface ClaseFiltros {
  sede_id?: number;
  tipo?: string;
}

export interface ClaseRepository {
  crear(clase: ClaseNueva): Promise<Clase>;
  buscarPorId(id: number): Promise<ClaseConCupo | null>;
  listar(filtros: ClaseFiltros, opciones: OpcionesPaginacion): Promise<ClaseConCupo[]>;
}
