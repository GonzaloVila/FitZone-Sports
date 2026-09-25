import type { InjectionToken } from '@nestjs/common';
import type { Cancha } from '../entities/cancha.entity';

export const CANCHA_REPOSITORY: InjectionToken = 'CANCHA_REPOSITORY';

export interface OpcionesListadoCanchas {
  estado?: 'OPERATIVA' | 'EN_MANTENIMIENTO';
  page: number;
  perPage: number;
}

export interface CanchaNueva {
  sede_id: number;
  tipo: 'PADDLE' | 'FUTBOL5';
  costo_por_hora: number;
  estado?: 'OPERATIVA' | 'EN_MANTENIMIENTO';
}

export interface CanchaActualizable {
  costo_por_hora?: number;
  estado?: 'OPERATIVA' | 'EN_MANTENIMIENTO';
}

export interface CanchaRepository {
  listarPorSede(sedeId: number, opciones: OpcionesListadoCanchas): Promise<Cancha[]>;
  crear(cancha: CanchaNueva): Promise<Cancha>;
  buscarPorId(id: number): Promise<Cancha | null>;
  actualizar(id: number, cambios: CanchaActualizable): Promise<Cancha | null>;
}
