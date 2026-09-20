import type { InjectionToken } from "@nestjs/common";
import type {
  Socio,
  SocioActualizable,
  SocioNuevo,
} from "../entities/socio.entity";

export const SOCIO_REPOSITORY: InjectionToken = "SOCIO_REPOSITORY";

export interface SocioRepository {
  crear(socio: SocioNuevo): Promise<Socio>;
  buscarPorId(id: number): Promise<Socio | null>;
  actualizar(id: number, cambios: SocioActualizable): Promise<Socio | null>;
  eliminar(id: number): Promise<void>;
}