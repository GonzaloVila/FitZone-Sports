import { computed, onScopeDispose, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { useServicios } from '@/compartido/servicios'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { marcasDeClases } from '../marcasClases'
import type { EsperaClase, ReservaClase } from '../services/servicioClases'

// Las reservas y esperas de un mismo socio: pocas, aunque las canceladas se acumulen en el listado.
const POR_PAGINA = 100

// Marcas "Reservada" / "En espera" de la agenda del socio. Hace una consulta extra (reservas y esperas del socio) al abrirla
// y cada vez que se llama a `recargar`; el personal no la hace. Es una ayuda: si la consulta falla, la agenda sigue sin marcas.
export function useMarcasClases(clases: MaybeRefOrGetter<readonly { id: number }[]>, esSocio: MaybeRefOrGetter<boolean>) {
  const servicio = useServicios().clases
  const { socioId } = useUsuarioSesion()

  const reservas = ref<ReservaClase[]>([])
  const esperas = ref<EsperaClase[]>([])
  const marcas = computed(() => marcasDeClases(toValue(clases), reservas.value, esperas.value))

  // Descarte de respuestas viejas.
  let ultimaConsulta = 0
  let controlador: AbortController | undefined

  async function recargar() {
    const id = socioId.value
    if (!toValue(esSocio) || id === null) return
    const consulta = ++ultimaConsulta
    controlador?.abort()
    controlador = new AbortController()
    const { signal } = controlador
    try {
      // La reserva vigente se pide por su estado; las esperas vigentes son dos estados, así que se filtran al recibirlas.
      const [confirmadas, listaEsperas] = await Promise.all([
        servicio.listarReservas({ socioId: id, estado: 'CONFIRMADA' }, 1, POR_PAGINA, signal),
        servicio.listarEsperas({ socioId: id }, 1, POR_PAGINA, signal),
      ])
      if (consulta !== ultimaConsulta) return
      reservas.value = confirmadas.items
      esperas.value = listaEsperas.items
    } catch {
      // Sin marcas: no es motivo para avisar nada en la agenda.
    }
  }

  onScopeDispose(() => {
    ultimaConsulta++
    controlador?.abort()
  })

  void recargar()

  return { marcas, recargar }
}
