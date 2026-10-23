import { inject, type InjectionKey } from 'vue'
import type { ServicioAcceso } from '@/features/acceso/services/servicioAcceso'
import type { ServicioClases } from '@/features/clases/services/servicioClases'
import type { ServicioSedes } from '@/features/sedes/services/servicioSedes'
import type { ServicioSesion } from '@/features/sesion/services/servicioSesion'
import type { ServicioSocios } from '@/features/socios/services/servicioSocios'
import type { ServicioUsuarios } from '@/features/usuarios/services/servicioUsuarios'

export interface Servicios {
  sesion: ServicioSesion
  socios: ServicioSocios
  sedes: ServicioSedes
  usuarios: ServicioUsuarios
  acceso: ServicioAcceso
  clases: ServicioClases
}

export const ServiciosKey: InjectionKey<Servicios> = Symbol('servicios')

// Solo se usa desde setup o composables de features/, nunca desde ui/ ni dentro de funciones de lógica
// (inject solo funciona durante el setup de un componente).
export function useServicios(): Servicios {
  const servicios = inject(ServiciosKey)
  if (!servicios) {
    throw new Error('Faltan los servicios: main.ts tiene que hacer app.provide(ServiciosKey, ...) antes de montar la app.')
  }
  return servicios
}
