import { computed, onScopeDispose, reactive, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import type { FiltrosClases, Clase } from '../services/servicioClases'
import type { FiltrosAgendaClases } from '../tipos'

export const POR_PAGINA_CLASES = 10
const ESPERA_BUSQUEDA_MS = 300

// `sedeInicial` es la sede con la que arranca el filtro de quien no tiene una fija (la sede activa del personal; el SOCIO no
// la pasa y ve todas). Puede llegar después, cuando terminan de cargar las sedes: se aplica una sola vez y solo si el filtro
// sigue en "todas".
export function useAgendaClases(sedeInicial?: MaybeRefOrGetter<number | null>) {
  const servicio = useServicios().clases
  const { sedeId } = useUsuarioSesion()

  // RECEPCION arranca viendo su sede; los demás, la sede inicial si la hay o todas.
  const filtros = reactive<FiltrosAgendaClases>({ tipo: '', sede: sedeId.value === null ? '' : String(sedeId.value) })
  let sedeInicialAplicada = sedeId.value !== null
  watch(
    () => toValue(sedeInicial) ?? null,
    (id) => {
      if (sedeInicialAplicada || id === null) return
      sedeInicialAplicada = true
      if (filtros.sede === '') filtros.sede = String(id)
    },
    { immediate: true },
  )
  const pagina = ref(1)
  const items = ref<Clase[]>([])
  const total = ref(0)
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA_CLASES)))

  // El tipo (disciplina) se aplica con debounce; la sede, de inmediato.
  const tipoAplicado = ref('')
  let temporizador: ReturnType<typeof setTimeout> | undefined
  watch(
    () => filtros.tipo,
    (tipo) => {
      clearTimeout(temporizador)
      temporizador = setTimeout(() => {
        tipoAplicado.value = tipo.trim()
      }, ESPERA_BUSQUEDA_MS)
    },
  )

  function filtrosParaApi(): FiltrosClases {
    const id = Number(filtros.sede)
    return {
      tipo: tipoAplicado.value || undefined,
      sedeId: filtros.sede && Number.isInteger(id) ? id : undefined,
    }
  }

  // Descarte de respuestas viejas: cada consulta tiene un número y su propio AbortController.
  let ultimaConsulta = 0
  let controlador: AbortController | undefined

  async function cargar() {
    const consulta = ++ultimaConsulta
    controlador?.abort()
    controlador = new AbortController()

    cargando.value = true
    error.value = null
    try {
      const lista = await servicio.listar(filtrosParaApi(), pagina.value, POR_PAGINA_CLASES, controlador.signal)
      if (consulta !== ultimaConsulta) return

      total.value = lista.total
      // Si la página pedida quedó fuera de rango, se vuelve a la última.
      if (lista.items.length === 0 && lista.total > 0 && pagina.value > totalPaginas.value) {
        pagina.value = totalPaginas.value
        return
      }
      items.value = lista.items
    } catch (e) {
      if (consulta !== ultimaConsulta) return
      items.value = []
      total.value = 0
      error.value = mensajeDeError(e, 'No se pudo cargar la agenda de clases.')
    } finally {
      if (consulta === ultimaConsulta) cargando.value = false
    }
  }

  // Cambiar un filtro vuelve a la página 1; si ya estaba en la 1, recarga directamente.
  watch([tipoAplicado, () => filtros.sede], () => {
    if (pagina.value !== 1) pagina.value = 1
    else void cargar()
  })
  watch(pagina, () => void cargar())

  onScopeDispose(() => {
    clearTimeout(temporizador)
    ultimaConsulta++
    controlador?.abort()
  })

  void cargar()

  return { filtros, pagina, items, total, totalPaginas, cargando, error, recargar: cargar }
}
