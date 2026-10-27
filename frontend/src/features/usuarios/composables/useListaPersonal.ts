import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import {
  leerConsultaPersonal,
  parametrosDeConsultaPersonal,
  sinParametrosDePersonal,
  type ConsultaPersonal,
} from '../direccion'
import type { FiltrosUsuarios, Usuario } from '../services/servicioUsuarios'

const POR_PAGINA = 10
const ESPERA_BUSQUEDA_MS = 300
const ROL = 'RECEPCION' as const

// Listado paginado de recepcionistas para el gerente central. El nombre buscado y la página viven en la dirección
// (?nombre=, ?pagina=): sobreviven a recargar y a compartir el enlace, y cada cambio reemplaza la entrada del historial.
export function useListaPersonal() {
  const servicio = useServicios().usuarios
  const route = useRoute()
  const router = useRouter()

  // Lo que dice la dirección. Mientras la ruta deja de ser la de Personal (hasta que se desmonta la pantalla) se conserva
  // lo último, para no reaccionar a los parámetros de otra pantalla.
  const consulta = shallowRef<ConsultaPersonal>(leerConsultaPersonal(route.query))
  watch(
    () => (route.name === 'personal' ? route.query : null),
    (query) => {
      if (query) consulta.value = leerConsultaPersonal(query)
    },
  )

  function actualizar(cambios: Partial<ConsultaPersonal>) {
    const siguiente = { ...consulta.value, ...cambios }
    void router.replace({ query: { ...sinParametrosDePersonal(route.query), ...parametrosDeConsultaPersonal(siguiente) } })
  }

  // El texto se muestra al instante y se escribe en la dirección con retraso; si la dirección cambia por otro lado (Atrás,
  // un enlace), el campo la sigue.
  const nombre = ref(consulta.value.nombre)
  let temporizador: ReturnType<typeof setTimeout> | undefined
  watch(nombre, (texto) => {
    clearTimeout(temporizador)
    temporizador = setTimeout(() => {
      if (texto.trim() !== consulta.value.nombre) actualizar({ nombre: texto.trim(), pagina: 1 })
    }, ESPERA_BUSQUEDA_MS)
  })
  watch(
    () => consulta.value.nombre,
    (texto) => {
      if (nombre.value.trim() !== texto) nombre.value = texto
    },
  )

  const pagina = computed({
    get: () => consulta.value.pagina,
    set: (numero: number) => actualizar({ pagina: numero }),
  })

  const items = ref<Usuario[]>([])
  const total = ref(0)
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA)))

  // Descarte de respuestas viejas: cada consulta tiene un número y su propio AbortController.
  let ultimaConsulta = 0
  let controlador: AbortController | undefined

  async function cargar() {
    const numero = ++ultimaConsulta
    controlador?.abort()
    controlador = new AbortController()

    cargando.value = true
    error.value = null
    try {
      const filtros: FiltrosUsuarios = { rol: ROL, ...(consulta.value.nombre ? { nombre: consulta.value.nombre } : {}) }
      const lista = await servicio.listar(filtros, pagina.value, POR_PAGINA, controlador.signal)
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
      error.value = mensajeDeError(e, 'No se pudo cargar el listado de recepcionistas.')
    } finally {
      if (numero === ultimaConsulta) cargando.value = false
    }
  }

  // Cualquier cambio de lo que se pide (nombre, página) vuelve a consultar.
  watch([() => consulta.value.nombre, () => consulta.value.pagina], () => void cargar())

  const hayFiltrosActivos = computed(() => nombre.value.trim().length > 0)

  function limpiarFiltros() {
    clearTimeout(temporizador)
    nombre.value = ''
    if (consulta.value.nombre !== '') actualizar({ nombre: '', pagina: 1 })
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
    recargar: cargar,
  }
}
