import { inject, type InjectionKey } from 'vue'
import type { ServicioSesion } from '@/features/sesion/services/servicioSesion'

export interface Servicios {
  sesion: ServicioSesion
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
