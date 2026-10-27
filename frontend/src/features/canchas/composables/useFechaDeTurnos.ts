import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fechaDeHoy } from '../presentacion'
import { fechaDeTurnosDe, fechaPermitida, parametrosDeFecha, sinFecha, ultimaFecha } from '../turnos'

// El día que se mira en la pantalla de turnos vive en la dirección (?fecha=): sobrevive a recargar y a compartir el enlace.
// Sin parámetro (o con uno fuera del rango permitido: de hoy a hoy + 6) es hoy. Elegir un día reemplaza la entrada del
// historial (Atrás no recorre cada día) y conserva el resto de la dirección: el origen ("volver") y los filtros de la lista.
//
// - `fecha` es el día que se está mirando (siempre válido y dentro del rango).
// - `campo` es lo que muestra el campo de fecha: sigue a `fecha`; si se escribe un día fuera del rango, el campo vuelve al
//   día que se está mirando (el navegador deja tipear cualquier fecha aunque tenga min y max); un campo vacío (mientras se
//   edita) no cambia nada.
export function useFechaDeTurnos(hoy: string = fechaDeHoy()) {
  const route = useRoute()
  const router = useRouter()

  const ultimo = ultimaFecha(hoy)

  const fecha = computed({
    get: () => fechaDeTurnosDe(route.query, hoy),
    set: (valor: string) => {
      void router.replace({ query: { ...sinFecha(route.query), ...parametrosDeFecha(valor, hoy) } })
    },
  })

  const campo = ref(fecha.value)
  watch(fecha, (nueva) => {
    campo.value = nueva
  })
  watch(campo, async (escrita) => {
    if (escrita === '' || escrita === fecha.value) return
    if (fechaPermitida(escrita, hoy)) {
      fecha.value = escrita
      return
    }
    await nextTick()
    campo.value = fecha.value
  })

  return { hoy, ultimo, fecha, campo }
}
