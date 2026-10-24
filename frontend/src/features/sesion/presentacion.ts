import type { Rol } from './tipos'

export type EtiquetaRol = 'Gerente' | 'Recepción' | 'Socio' | 'Externo' | 'Usuario'

const ETIQUETA_ROL: Record<Rol, EtiquetaRol> = {
  GERENTE: 'Gerente',
  RECEPCION: 'Recepción',
  SOCIO: 'Socio',
  EXTERNO: 'Externo',
}

// Un rol desconocido (null) se muestra como "Usuario".
export function etiquetaRol(rol: Rol | null): EtiquetaRol {
  return rol === null ? 'Usuario' : ETIQUETA_ROL[rol]
}
