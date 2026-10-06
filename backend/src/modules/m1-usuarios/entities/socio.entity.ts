import type { PlanMembresia } from './membresia.entity';

export interface Socio {
  id: number;
  usuario_id: number;
  nombre: string;
  email: string;
  sede_origen_id: number;
  fecha_alta: Date;
  // Baja logica: false cuando el usuario dejo de ser socio (la fila se conserva
  // para el historial). `fecha_baja` es null mientras siga activo.
  activo: boolean;
  fecha_baja: Date | null;
}

export interface SocioNuevo {
  usuario_id: number;
  sede_origen_id: number;
  plan: PlanMembresia;
}

export interface SocioActualizable {
  sede_origen_id?: number;
}