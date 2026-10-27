import type { Rol } from '@/features/sesion/tipos'

// Reservar una cancha es de quien juega: el SOCIO y el cliente EXTERNO (RF-01). RECEPCION y GERENTE consultan la
// disponibilidad pero no reservan. Con esta misma regla el SOCIO y el EXTERNO tienen "Mis reservas".
export function puedeReservar(rol: Rol | null | undefined): boolean {
  return rol === 'SOCIO' || rol === 'EXTERNO'
}
