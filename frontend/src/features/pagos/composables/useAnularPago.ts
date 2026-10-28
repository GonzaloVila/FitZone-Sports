import { ref } from 'vue'
import { useServicios } from '@/compartido/servicios'
import { mensajeAnulacion } from '../errores'

export function useAnularPago(alTerminar: () => void | Promise<void>) {
  const servicio = useServicios().pagos

  const anulando = ref(false)
  const error = ref<string | null>(null)

  async function anular(pagoId: number): Promise<boolean> {
    if (anulando.value) return false
    anulando.value = true
    error.value = null
    try {
      await servicio.anular(pagoId)
      return true
    } catch (e) {
      error.value = mensajeAnulacion(e)
      return false
    } finally {
      await alTerminar()
      anulando.value = false
    }
  }

  function limpiar() {
    error.value = null
  }

  return { anulando, error, anular, limpiar }
}
