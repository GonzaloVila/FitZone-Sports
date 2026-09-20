import type { InjectionToken } from "@nestjs/common";
import type { PlanMembresia } from "./socio.repository";

export type EstadoMembresia = "ACTIVA" | "VENCIDA" | "SUSPENDIDA";

export interface Membresia {
  id: number;
  socio_id: number;
  plan: PlanMembresia;
  estado: EstadoMembresia;
  fecha_inicio: Date;
  fecha_fin: Date;
  renueva_automatica: boolean;
}

export interface MembresiaNueva {
  socio_id: number;
  plan: PlanMembresia;
  renueva_automatica?: boolean;
  fecha_inicio?: Date;
}

export const MEMBRESIA_REPOSITORY: InjectionToken = "MEMBRESIA_REPOSITORY";

export interface MembresiaRepository {
  crear(membresia: MembresiaNueva): Promise<Membresia>;
  buscarPorSocioId(socioId: number): Promise<Membresia | null>;
}