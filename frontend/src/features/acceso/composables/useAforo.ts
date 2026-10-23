import { computed, ref, watch, type Ref } from 'vue'
import { useActualizacionPeriodica } from '@/compartido/composables/useActualizacionPeriodica'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { Aforo } from '../services/servicioAcceso'

export function useAforo(sedeId: Ref<number | null | undefined>) {
  const servicio = useServicios().acceso

  const aforo = ref<Aforo | null>(null)
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const estaLleno = computed(() => {
    if (!aforo.value) return false
    return aforo.value.restante <= 0 || aforo.value.aforoActual >= aforo.value.aforoMaximo
  })

  let controlador: AbortController | undefined

  async function consultarAforo() {
    const id = sedeId.value
    if (!id) {
      aforo.value = null
      error.value = null
      return
    }

    controlador?.abort()
    controlador = new AbortController()

    try {
      if (!aforo.value) cargando.value = true
      const respuesta = await servicio.obtenerAforo(id, controlador.signal)
      aforo.value = respuesta
      error.value = null
    } catch (e) {
      if (controlador.signal.aborted) return
      error.value = mensajeDeError(e, 'No se pudo obtener el aforo de la sede.')
    } finally {
      cargando.value = false
    }
  }

  // Se actualiza periódicamente cada 10 segundos
  const { reanudar, detener, ejecutarAhora } = useActualizacionPeriodica(consultarAforo, {
    intervaloMs: 10000,
    inmediato: false,
  })

  watch(
    () => sedeId.value,
    (nuevoId) => {
      aforo.value = null
      if (nuevoId) {
        void consultarAforo()
      }
    },
    { immediate: true },
  )

  return {
    aforo,
    cargando,
    error,
    estaLleno,
    refrescar: ejecutarAhora,
    pausar: detener,
    reanudar,
  }
}
