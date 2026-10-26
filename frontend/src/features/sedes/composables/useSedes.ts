import { computed, ref } from 'vue'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { Sede } from '../services/servicioSedes'

// Carga una vez el listado completo de sedes (para el filtro y para mostrar nombres en vez de ids).
export function useSedes() {
  const servicio = useServicios().sedes

  const sedes = ref<Sede[]>([])
  const cargando = ref(true)
  const error = ref<string | null>(null)

  const nombres = computed(() => new Map(sedes.value.map((sede) => [sede.id, sede.nombre])))

  // Mientras carga no se muestra un id suelto; si falló, se cae a "Sede <id>".
  function nombreDeSede(id: number): string {
    if (cargando.value) return 'Cargando…'
    return nombres.value.get(id) ?? `Sede ${id}`
  }

  // También sirve para volver a pedir el listado (por ejemplo, después de crear una sede): la lista se reemplaza sin
  // pasar por "Cargando…", así los selectores no parpadean.
  async function cargar() {
    try {
      sedes.value = await servicio.listar()
      error.value = null
    } catch (e) {
      error.value = mensajeDeError(e, 'No se pudo cargar el listado de sedes.')
    } finally {
      cargando.value = false
    }
  }

  void cargar()

  return { sedes, cargando, error, nombreDeSede, recargar: cargar }
}
