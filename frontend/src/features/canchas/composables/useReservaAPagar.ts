import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { reservaAPagarDe, sinReservaAPagar } from '../direccion'
import { puedePagarse } from '../presentacion'
import type { ReservaCancha } from '../services/servicioCanchas'

// ?pagar=<id> en la dirección (la deja la redirección de /pagos/nuevo): trae esa reserva y le pasa a quien lo usa la reserva
// para abrir el modal de pago. El parámetro se quita enseguida de la dirección, así recargar o volver no reabre el modal.
export function useReservaAPagar(abrir: (reserva: ReservaCancha) => void) {
  const servicio = useServicios().canchas
  const route = useRoute()
  const router = useRouter()

  const error = ref<string | null>(null)

  watch(
    () => reservaAPagarDe(route.query),
    async (id) => {
      if (id === null) return
      void router.replace({ query: sinReservaAPagar(route.query) })
      error.value = null
      try {
        const reserva = await servicio.obtenerReserva(id)
        if (puedePagarse(reserva.estado)) abrir(reserva)
        else error.value = 'Esa reserva está cancelada: no se puede pagar.'
      } catch (e) {
        error.value = mensajeDeError(e, 'No se pudo cargar la reserva a pagar.')
      }
    },
    { immediate: true },
  )

  return { error }
}
