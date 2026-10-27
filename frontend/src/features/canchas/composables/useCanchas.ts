import { computed, onScopeDispose, reactive, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import {
  leerConsultaCanchas,
  parametrosDeConsultaCanchas,
  parametrosDesdeCanchas,
  sinParametrosDeCanchas,
  type ConsultaCanchas,
} from '../direccion'
import type { Cancha, EstadoCancha, FiltrosCanchas } from '../services/servicioCanchas'
import { ESTADOS_CANCHA } from '../presentacion'

export const POR_PAGINA_CANCHAS = 12

// Los filtros (sede y estado) y la página viven en la dirección, junto con la vista: sobreviven a ir a la grilla de turnos
// y volver, a recargar y a compartir el enlace. Cada cambio reemplaza la entrada del historial (Atrás no recorre cada
// selección). Un parámetro ausente es el valor por defecto: `sedePorDefecto` es la sede con la que arranca la lista (la
// sede activa); puede llegar después, cuando terminan de cargar las sedes. Las canchas se piden siempre de una sede.
export function useCanchas(sedePorDefecto: MaybeRefOrGetter<number | null>) {
  const servicio = useServicios().canchas
  const route = useRoute()
  const router = useRouter()

  // Lo que dice la dirección. Mientras la ruta deja de ser la de la lista (al ir a la grilla, hasta que se desmonta la
  // pantalla) se conserva lo último, para no reaccionar a los parámetros de otra pantalla.
  const consulta = shallowRef<ConsultaCanchas>(leerConsultaCanchas(route.query))
  watch(
    () => (route.name === 'canchas' ? route.query : null),
    (query) => {
      if (query) consulta.value = leerConsultaCanchas(query)
    },
  )

  const sede = computed(() => {
    const porDefecto = toValue(sedePorDefecto)
    return consulta.value.sede ?? (porDefecto === null ? '' : String(porDefecto))
  })

  function actualizar(cambios: Partial<ConsultaCanchas>) {
    const siguiente = { ...consulta.value, ...cambios }
    void router.replace({ query: { ...sinParametrosDeCanchas(route.query), ...parametrosDeConsultaCanchas(siguiente) } })
  }

  // Cambiar un filtro vuelve a la página 1.
  const filtros = reactive({
    sede: computed({
      get: () => sede.value,
      set: (valor: string) => actualizar({ sede: valor, pagina: 1 }),
    }),
    estado: computed({
      get: () => consulta.value.estado,
      set: (valor: string) => actualizar({ estado: valor, pagina: 1 }),
    }),
  })
  const pagina = computed({
    get: () => consulta.value.pagina,
    set: (numero: number) => actualizar({ pagina: numero }),
  })

  // Los parámetros con los que la grilla de turnos reconstruye esta lista al volver.
  const parametrosDetalle = computed(() => parametrosDesdeCanchas(consulta.value))

  const items = ref<Cancha[]>([])
  const total = ref(0)
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA_CANCHAS)))

  function filtrosParaApi(): FiltrosCanchas {
    const estado: EstadoCancha | undefined = ESTADOS_CANCHA.find((valor) => valor === consulta.value.estado)
    return { estado }
  }

  // Descarte de respuestas viejas: cada consulta tiene un número y su propio AbortController.
  let ultimaConsulta = 0
  let controlador: AbortController | undefined

  async function cargar() {
    const numero = ++ultimaConsulta
    controlador?.abort()
    const idSede = Number(sede.value)
    if (!sede.value || !Number.isInteger(idSede)) {
      items.value = []
      total.value = 0
      error.value = null
      cargando.value = false
      return
    }

    controlador = new AbortController()
    cargando.value = true
    error.value = null
    try {
      const lista = await servicio.listar(idSede, filtrosParaApi(), pagina.value, POR_PAGINA_CANCHAS, controlador.signal)
      if (numero !== ultimaConsulta) return

      total.value = lista.total
      // Si la página pedida quedó fuera de rango, se vuelve a la última.
      if (lista.items.length === 0 && lista.total > 0 && pagina.value > totalPaginas.value) {
        pagina.value = totalPaginas.value
        return
      }
      items.value = lista.items
    } catch (e) {
      if (numero !== ultimaConsulta) return
      items.value = []
      total.value = 0
      error.value = mensajeDeError(e, 'No se pudieron cargar las canchas.')
    } finally {
      if (numero === ultimaConsulta) cargando.value = false
    }
  }

  // Cualquier cambio de lo que se pide (sede, estado, página) vuelve a consultar.
  watch([sede, () => consulta.value.estado, () => consulta.value.pagina], () => void cargar())

  onScopeDispose(() => {
    ultimaConsulta++
    controlador?.abort()
  })

  void cargar()

  return {
    filtros,
    pagina,
    items,
    total,
    totalPaginas,
    cargando,
    error,
    parametrosDetalle,
    recargar: cargar,
  }
}
