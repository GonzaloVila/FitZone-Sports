import type { InjectionToken } from "@nestjs/common";
import type { OpcionesPaginacion } from "../../../commons/paginacion";
import type { EstadoMembresia } from "../entities/membresia.entity";
import type {
  PlanMembresia,
  Socio,
  SocioActualizable,
  SocioNuevo,
} from "../entities/socio.entity";

export const SOCIO_REPOSITORY: InjectionToken = "SOCIO_REPOSITORY";

// En nomenclatura de dominio (snake_case), no la del contrato. El service
// traduce desde el query DTO, que si usa camelCase para los filtros.
export interface FiltrosSocios {
  sede_origen_id?: number;
  estado_membresia?: EstadoMembresia;
  plan?: PlanMembresia;
  nombre?: string;
}

export interface SocioRepository {
  listar(
    filtros: FiltrosSocios,
    opciones: OpcionesPaginacion,
  ): Promise<Socio[]>;
  crear(socio: SocioNuevo): Promise<Socio>;
  buscarPorId(id: number): Promise<Socio | null>;
  buscarPorUsuarioId(usuarioId: number): Promise<Socio | null>;
  actualizar(id: number, cambios: SocioActualizable): Promise<Socio | null>;
  eliminar(id: number): Promise<void>;
}