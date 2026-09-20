import type { InjectionToken } from "@nestjs/common";
import type {
  Usuario,
  UsuarioActualizable,
  UsuarioNuevo,
} from "../entities/usuario.entity";

export const USUARIO_REPOSITORY: InjectionToken = "USUARIO_REPOSITORY";

export interface UsuarioRepository {
  crear(usuario: UsuarioNuevo): Promise<Usuario>;
  buscarPorId(id: number): Promise<Usuario | null>;
  buscarPorDniOEmail(dni: string, email: string): Promise<Usuario | null>;
  actualizar(id: number, cambios: UsuarioActualizable): Promise<Usuario | null>;
}