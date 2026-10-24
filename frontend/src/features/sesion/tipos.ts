import type { components } from '@/types/api'

// LoginOut.rol llega tipado como string sin enum; los valores válidos los define el schema Rol del contrato.
// Un rol que no sea uno de estos se trata como sin permisos (UsuarioSesion.rol = null).
export type Rol = components['schemas']['Rol']

// Record<Rol, true> obliga a actualizar esta lista si el contrato agrega un rol.
const ROLES_VALIDOS: Record<Rol, true> = {
  EXTERNO: true,
  SOCIO: true,
  RECEPCION: true,
  GERENTE: true,
}

export function esRol(valor: string): valor is Rol {
  return Object.hasOwn(ROLES_VALIDOS, valor)
}

export type SesionIniciada = components['schemas']['LoginOut']

// Lo que el front guarda del usuario autenticado; el token no forma parte de esto.
export interface UsuarioSesion {
  rol: Rol | null
  usuarioId?: number
  sedeId?: number
  socioId?: number
}

export function usuarioDesdeSesion(sesion: SesionIniciada): UsuarioSesion {
  return {
    rol: esRol(sesion.rol) ? sesion.rol : null,
    usuarioId: sesion.usuarioId,
    sedeId: sesion.sedeId,
    socioId: sesion.socioId,
  }
}
