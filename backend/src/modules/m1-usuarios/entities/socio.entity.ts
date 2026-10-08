import type { PlanMembresia } from './membresia.entity';

export interface Socio {
  id: number;
  usuarioId: number;
  nombre: string;
  email: string;
  sedeOrigenId: number;
  fechaAlta: Date;
  // Baja logica: false cuando el usuario dejo de ser socio (la fila se conserva
  // para el historial). `fecha_baja` es null mientras siga activo.
  activo: boolean;
  fechaBaja: Date | null;
}

export interface SocioNuevo {
  usuarioId: number;
  sedeOrigenId: number;
  plan: PlanMembresia;
}

export interface SocioActualizable {
  sedeOrigenId?: number;
}