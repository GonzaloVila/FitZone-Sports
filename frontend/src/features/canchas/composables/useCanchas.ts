import { computed, onScopeDispose, ref, watch } from 'vue'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { ESTADOS_CANCHA } from '../presentacion'
import type { Cancha, EstadoCancha, FiltrosCanchas } from '../services/servicioCanchas'

const POR_PAGINA = 12

export function useCanchas() {
  const servicio = useServicios().canchas
  const { sedeId: sedeSesion } = useUsuarioSesion()
  const { sedes, cargando: cargandoSedes, error: errorSedes } = useSedes()

  const sede = ref(sedeSesion.value !== null ? String(sedeSesion.value) : '')
  const estado = ref('')
  const pagina = ref(1)
  const items = ref<Cancha[]>([])
  const total = ref(0)
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA)))
  const sedeElegida = computed<number | null>(() => {
    const id = Number(sede.value)
    return Number.isInteger(id) && id > 0 ? id : null
  })

  function filtros(): FiltrosCanchas {
    const estadoValido: EstadoCancha | undefined = ESTADOS_CANCHA.find((valor) => valor === estado.value)
    return { estado: estadoValido }
  }

  let ultimaConsulta = 0
  let controlador: AbortController | undefined

  async function cargar() {
    const idSede = sedeElegida.value
    if (idSede === null) {
      items.value = []
      total.value = 0
      error.value = null
      cargando.value = false
      return
    }

    const consulta = ++ultimaConsulta
    controlador?.abort()
    controlador = new AbortController()
    cargando.value = true
    error.value = null
    try {
      const lista = await servicio.listar(idSede, filtros(), pagina.value, POR_PAGINA, controlador.signal)
      if (consulta !== ultimaConsulta) return
      total.value = lista.total
      if (lista.items.length === 0 && lista.total > 0 && pagina.value > totalPaginas.value) {
        pagina.value = totalPaginas.value
        return
      }
      items.value = lista.items
    } catch (e) {
      if (consulta !== ultimaConsulta) return
      items.value = []
      total.value = 0
      error.value = mensajeDeError(e, 'No se pudieron cargar las canchas.')
    } finally {
      if (consulta === ultimaConsulta) cargando.value = false
    }
  }

  watch([sede, estado], () => {
    if (pagina.value !== 1) pagina.value = 1
    else void cargar()
  })
  watch(pagina, () => void cargar())
  onScopeDispose(() => {
    ultimaConsulta++
    controlador?.abort()
  })
  void cargar()

  return {
    sedes,
    cargandoSedes,
    errorSedes,
    sede,
    estado,
    pagina,
    items,
    total,
    totalPaginas,
    cargando,
    error,
  }
}
