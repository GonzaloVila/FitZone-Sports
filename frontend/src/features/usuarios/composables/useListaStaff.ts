import { computed, onScopeDispose, ref, watch } from 'vue'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { FiltrosUsuarios, Usuario } from '../services/servicioUsuarios'

const POR_PAGINA = 10
const ESPERA_BUSQUEDA_MS = 300
const ROL = 'RECEPCION' as const

// Listado paginado de recepcionistas para el gerente central.
export function useListaStaff() {
  const servicio = useServicios().usuarios

  const nombre = ref('')
  const nombreAplicado = ref('')
  const pagina = ref(1)
  const items = ref<Usuario[]>([])
  const total = ref(0)
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA)))

  let temporizador: ReturnType<typeof setTimeout> | undefined
  watch(nombre, (valor) => {
    clearTimeout(temporizador)
    temporizador = setTimeout(() => {
      nombreAplicado.value = valor.trim()
    }, ESPERA_BUSQUEDA_MS)
  })

  // Descarte de respuestas viejas: cada consulta tiene un número y su propio AbortController.
  let ultimaConsulta = 0
  let controlador: AbortController | undefined

  async function cargar() {
    const consulta = ++ultimaConsulta
    controlador?.abort()
    controlador = new AbortController()
    const { signal } = controlador

    cargando.value = true
    error.value = null
    try {
      const filtros: FiltrosUsuarios = {
        rol: ROL,
        ...(nombreAplicado.value ? { nombre: nombreAplicado.value } : {}),
      }
      const lista = await servicio.listar(filtros, pagina.value, POR_PAGINA, signal)
      if (consulta !== ultimaConsulta) return

      total.value = lista.total
      // Si la página quedó fuera de rango (por ejemplo, se filtró mientras se
      // estaba en la última), se vuelve a la última válida.
      if (lista.items.length === 0 && lista.total > 0 && pagina.value > totalPaginas.value) {
        pagina.value = totalPaginas.value
        return
      }
      items.value = lista.items
    } catch (e) {
      if (consulta !== ultimaConsulta) return
      items.value = []
      total.value = 0
      error.value = mensajeDeError(e, 'No se pudo cargar el listado de recepcionistas.')
    } finally {
      if (consulta === ultimaConsulta) cargando.value = false
    }
  }

  // Cambiar la búsqueda vuelve a la página 1; si ya estaba en la 1, recarga.
  watch(nombreAplicado, () => {
    if (pagina.value !== 1) pagina.value = 1
    else void cargar()
  })
  watch(pagina, () => void cargar())

  const hayFiltrosActivos = computed(() => nombre.value.trim().length > 0)

  function limpiarFiltros() {
    clearTimeout(temporizador)
    nombreAplicado.value = ''
    nombre.value = ''
  }

  function recargar() {
    return cargar()
  }

  onScopeDispose(() => {
    clearTimeout(temporizador)
    ultimaConsulta++
    controlador?.abort()
  })

  void cargar()

  return {
    nombre,
    pagina,
    porPagina: POR_PAGINA,
    items,
    total,
    totalPaginas,
    cargando,
    error,
    hayFiltrosActivos,
    limpiarFiltros,
    recargar,
  }
}
