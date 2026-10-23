import type { Rol } from './tipos'

// Nombre de la ruta comodín del router: no cuenta como una ruta que "existe" al validar un ?redirect.
export const NOMBRE_RUTA_NO_ENCONTRADA = 'no-encontrada'

// Cada rol (y el rol desconocido, null) tiene que poder entrar a su ruta inicial: el guard del router
// depende de eso para no entrar en bucles de redirección.
export function rutaInicialPorRol(rol: Rol | null): string {
  switch (rol) {
    case 'RECEPCION':
    case 'GERENTE':
      return '/socios'
    default:
      return '/inicio'
  }
}

// Una ruta sin `roles` solo requiere sesión; un rol desconocido nunca cumple una restricción.
export function rolPermitido(roles: readonly Rol[] | undefined, rol: Rol | null): boolean {
  if (!roles) return true
  return rol !== null && roles.includes(rol)
}
