import type { PlanMembresia } from "./socio.entity";

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