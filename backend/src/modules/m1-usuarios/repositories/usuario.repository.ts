import type { InjectionToken } from "@nestjs/common";
import type { OpcionesPaginacion } from "../../../commons/paginacion";
import type {
  Usuario,
  UsuarioActualizable,
  UsuarioNuevo,
  RolUsuario,
} from "../entities/usuario.entity";

export const USUARIO_REPOSITORY: InjectionToken = "USUARIO_REPOSITORY";

export interface FiltrosUsuarios {
  rol?: RolUsuario;
  nombre?: string;
  email?: string;
}

export interface UsuarioRepository {
  listar(
    filtros: FiltrosUsuarios,
    opciones: OpcionesPaginacion,
  ): Promise<Usuario[]>;
  crear(usuario: UsuarioNuevo): Promise<Usuario>;
  buscarPorId(id: number): Promise<Usuario | null>;
  buscarPorDniOEmail(dni: string, email: string): Promise<Usuario | null>;
  actualizar(id: number, cambios: UsuarioActualizable): Promise<Usuario | null>;
}