import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fechaDeHoy } from '../presentacion'
import { diasDeLaTira, fechaDeTurnosDe, parametrosDeFecha, sinFecha } from '../turnos'

// El día que se mira en la pantalla de turnos vive en la dirección (?fecha=): sobrevive a recargar y a compartir el enlace.
// Sin parámetro (o con uno que no es de la tira de siete días) es hoy. Elegir un día reemplaza la entrada del historial
// (Atrás no recorre cada día) y conserva el resto de la dirección: el origen ("volver") y los filtros de la lista.
export function useFechaDeTurnos(hoy: string = fechaDeHoy()) {
  const route = useRoute()
  const router = useRouter()

  const dias = diasDeLaTira(hoy)

  const fecha = computed({
    get: () => fechaDeTurnosDe(route.query, hoy),
    set: (valor: string) => {
      void router.replace({ query: { ...sinFecha(route.query), ...parametrosDeFecha(valor, hoy) } })
    },
  })

  return { hoy, dias, fecha }
}
