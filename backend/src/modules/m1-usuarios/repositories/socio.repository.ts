import type { InjectionToken } from "@nestjs/common";

export type PlanMembresia = "MENSUAL" | "TRIMESTRAL" | "ANUAL";

export interface Socio {
  id: number;
  usuario_id: number;
  sede_origen_id: number;
  fecha_alta: Date;
}

export interface SocioNuevo {
  usuario_id: number;
  sede_origen_id: number;
  plan?: PlanMembresia;
}

export interface SocioActualizable {
  sede_origen_id?: number;
}

export const SOCIO_REPOSITORY: InjectionToken = "SOCIO_REPOSITORY";

export interface SocioRepository {
  crear(socio: SocioNuevo): Promise<Socio>;
  buscarPorId(id: number): Promise<Socio | null>;
  actualizar(id: number, cambios: SocioActualizable): Promise<Socio | null>;
  eliminar(id: number): Promise<void>;
}