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
  fotoUrl: string | null;
  // Sede de trabajo (EmpleadoSede, solo RECEPCION). Null cuando el rol no la
  // tiene o cuando el recepcionista todavia no fue asignado (dato heredado).
  sedeId?: number | null;
}

export interface UsuarioNuevo {
  rol: RolAlta;
  dni: string;
  nombre: string;
  email: string;
  contrasenia: string;
  telefono?: string;
  fotoUrl?: string;
  // Solo RECEPCION: se materializa como fila de EmpleadoSede en la misma alta.
  sedeId?: number;
}

export interface UsuarioActualizable {
  nombre?: string;
  telefono?: string | null;
  fotoUrl?: string | null;
  contrasenia?: string;
  rol?: RolUsuario;
}
