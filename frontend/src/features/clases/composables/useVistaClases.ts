import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export type VistaClases = 'agenda' | 'mis-clases'

const VISTA_MIS_CLASES: VistaClases = 'mis-clases'

// La vista activa de la pantalla de Clases vive en la dirección (?vista=mis-clases; sin query, la agenda): Atrás, favoritos
// y recargar la conservan. Cambiarla es una navegación dentro de la misma pantalla, sin recargarla. "Mis clases" es solo
// del socio: para los demás cualquier valor de la dirección cae en la agenda.
export function useVistaClases(esSocio: MaybeRefOrGetter<boolean>) {
  const route = useRoute()
  const router = useRouter()

  const vista = computed<VistaClases>({
    get: () => (toValue(esSocio) && route.query.vista === VISTA_MIS_CLASES ? VISTA_MIS_CLASES : 'agenda'),
    set: (nueva) => {
      if (nueva === vista.value) return
      const query = { ...route.query }
      delete query.vista
      void router.push({ query: nueva === VISTA_MIS_CLASES ? { ...query, vista: VISTA_MIS_CLASES } : query })
    },
  })

  return { vista }
}
