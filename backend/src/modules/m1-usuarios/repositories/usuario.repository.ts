import type { InjectionToken } from "@nestjs/common";

export type RolUsuario = "SOCIO" | "EXTERNO" | "RECEPCION" | "GERENTE";

export type RolAlta = Exclude<RolUsuario, "SOCIO">;

export interface Usuario {
  id: number;
  rol: RolUsuario;
  dni: string;
  nombre: string;
  email: string;
  contrasenia: string;
  telefono: string | null;
  foto_url: string | null;
}

export interface UsuarioNuevo {
  rol: RolAlta;
  dni: string;
  nombre: string;
  email: string;
  contrasenia: string;
  telefono?: string;
  foto_url?: string;
}

export interface UsuarioActualizable {
  nombre?: string;
  telefono?: string | null;
  foto_url?: string | null;
  contrasenia?: string;
}

export const USUARIO_REPOSITORY: InjectionToken = "USUARIO_REPOSITORY";

export interface UsuarioRepository {
  crear(usuario: UsuarioNuevo): Promise<Usuario>;
  buscarPorId(id: number): Promise<Usuario | null>;
  buscarPorDniOEmail(dni: string, email: string): Promise<Usuario | null>;
  actualizar(id: number, cambios: UsuarioActualizable): Promise<Usuario | null>;
}