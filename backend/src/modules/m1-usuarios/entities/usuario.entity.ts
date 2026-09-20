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
  rol?: RolUsuario;
}
