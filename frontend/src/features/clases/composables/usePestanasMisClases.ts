import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  PESTANAS_MIS_CLASES,
  leerConsultaMisClases,
  parametrosDeConsultaMisClases,
  sinParametrosDeMisClases,
  type ConsultaMisClases,
  type PestanaMisClases,
} from '../direccion'

// La pestaña (Próximas / Pasadas) y la página de las pasadas de "Mis clases" viven en la dirección (?pestana=pasadas,
// ?pagina-clases=2): sobreviven a recargar y a volver del detalle de una clase. Sin parámetros es Próximas, página 1. Cada
// cambio reemplaza la entrada del historial (Atrás no recorre cada página) y cambiar de pestaña vuelve a la página 1.
// El parámetro de la página NO es `pagina`: esa es la de la agenda y las dos vistas comparten la dirección.
export function usePestanasMisClases() {
  const route = useRoute()
  const router = useRouter()

  const consulta = computed(() => leerConsultaMisClases(route.query))

  function actualizar(cambios: Partial<ConsultaMisClases>) {
    const siguiente = { ...consulta.value, ...cambios }
    void router.replace({ query: { ...sinParametrosDeMisClases(route.query), ...parametrosDeConsultaMisClases(siguiente) } })
  }

  const pestana = computed({
    get: (): PestanaMisClases => consulta.value.pestana,
    set: (valor: string) => {
      const elegida = PESTANAS_MIS_CLASES.find((candidata) => candidata === valor) ?? 'proximas'
      if (elegida !== consulta.value.pestana) actualizar({ pestana: elegida, pagina: 1 })
    },
  })

  const pagina = computed({
    get: () => consulta.value.pagina,
    set: (numero: number) => {
      if (numero !== consulta.value.pagina) actualizar({ pagina: numero })
    },
  })

  return { pestana, pagina }
}
