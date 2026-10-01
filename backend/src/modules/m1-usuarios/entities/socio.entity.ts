import type { PlanMembresia } from './membresia.entity';

export interface Socio {
  id: number;
  usuario_id: number;
  nombre: string;
  email: string;
  sede_origen_id: number;
  fecha_alta: Date;
}

export interface SocioNuevo {
  usuario_id: number;
  sede_origen_id: number;
  plan: PlanMembresia;
}

export interface SocioActualizable {
  sede_origen_id?: number;
}