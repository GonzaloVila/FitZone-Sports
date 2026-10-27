import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export type VistaCanchas = 'canchas' | 'mis-reservas'

const VISTA_MIS_RESERVAS: VistaCanchas = 'mis-reservas'

// La vista activa de la pantalla de Canchas vive en la dirección (?vista=mis-reservas; sin query, las canchas): Atrás,
// favoritos y recargar la conservan. Cambiarla es una navegación dentro de la misma pantalla, sin recargarla. "Mis reservas"
// es solo de quien reserva (`tieneMisReservas`): para los demás cualquier valor de la dirección cae en las canchas.
export function useVistaCanchas(tieneMisReservas: MaybeRefOrGetter<boolean>) {
  const route = useRoute()
  const router = useRouter()

  const vista = computed<VistaCanchas>({
    get: () => (toValue(tieneMisReservas) && route.query.vista === VISTA_MIS_RESERVAS ? VISTA_MIS_RESERVAS : 'canchas'),
    set: (nueva) => {
      if (nueva === vista.value) return
      const query = { ...route.query }
      delete query.vista
      void router.push({ query: nueva === VISTA_MIS_RESERVAS ? { ...query, vista: VISTA_MIS_RESERVAS } : query })
    },
  })

  return { vista }
}
