import { computed, onScopeDispose, reactive, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import {
  leerConsultaAgenda,
  parametrosDeConsulta,
  parametrosDesdeAgenda,
  sinParametrosDeAgenda,
  type ConsultaAgenda,
} from '../direccion'
import type { FiltrosClases, Clase } from '../services/servicioClases'

export const POR_PAGINA_CLASES = 10
const ESPERA_BUSQUEDA_MS = 300

// Los filtros (disciplina y sede) y la página viven en la dirección, junto con la vista: sobreviven a ir al detalle y volver,
// a recargar y a compartir el enlace. Cada cambio reemplaza la entrada del historial (Atrás no recorre cada selección).
// Un parámetro ausente es el valor por defecto: `sedePorDefecto` es la sede con la que arranca quien no tiene una fija (la
// sede activa del personal; el SOCIO no la pasa y ve todas); puede llegar después, cuando terminan de cargar las sedes.
// "Todas las sedes" elegida a propósito se escribe en la dirección y no vuelve sola a la sede por defecto.
export function useAgendaClases(sedePorDefecto?: MaybeRefOrGetter<number | null>) {
  const servicio = useServicios().clases
  const { sedeId } = useUsuarioSesion()
  const route = useRoute()
  const router = useRouter()

  // Lo que dice la dirección. Mientras la ruta deja de ser la de la agenda (al ir al detalle, hasta que se desmonta la
  // pantalla) se conserva lo último, para no reaccionar a los parámetros de otra pantalla.
  const consulta = shallowRef<ConsultaAgenda>(leerConsultaAgenda(route.query))
  watch(
    () => (route.name === 'clases' ? route.query : null),
    (query) => {
      if (query) consulta.value = leerConsultaAgenda(query)
    },
  )

  // El RECEPCION arranca viendo su sede; los demás, la sede por defecto si la hay o todas.
  const sedeAusente = computed(() => {
    const id = sedeId.value ?? toValue(sedePorDefecto) ?? null
    return id === null ? '' : String(id)
  })
  const sede = computed(() => consulta.value.sede ?? sedeAusente.value)

  function actualizar(cambios: Partial<ConsultaAgenda>) {
    const siguiente = { ...consulta.value, ...cambios }
    void router.replace({ query: { ...sinParametrosDeAgenda(route.query), ...parametrosDeConsulta(siguiente) } })
  }

  // El texto de la disciplina se muestra al instante y se escribe en la dirección con retraso; si la dirección cambia por
  // otro lado (Atrás, un enlace), el campo la sigue.
  const tipo = ref(consulta.value.tipo)
  let temporizador: ReturnType<typeof setTimeout> | undefined
  watch(tipo, (texto) => {
    clearTimeout(temporizador)
    temporizador = setTimeout(() => {
      if (texto.trim() !== consulta.value.tipo) actualizar({ tipo: texto.trim(), pagina: 1 })
    }, ESPERA_BUSQUEDA_MS)
  })
  watch(
    () => consulta.value.tipo,
    (texto) => {
      if (tipo.value.trim() !== texto) tipo.value = texto
    },
  )

  // Cambiar un filtro vuelve a la página 1.
  const filtros = reactive({
    tipo,
    sede: computed({
      get: () => sede.value,
      set: (valor: string) => actualizar({ sede: valor, pagina: 1 }),
    }),
  })
  const pagina = computed({
    get: () => consulta.value.pagina,
    set: (numero: number) => actualizar({ pagina: numero }),
  })

  // Los parámetros con los que el detalle reconstruye esta agenda al volver.
  const parametrosDetalle = computed(() => parametrosDesdeAgenda(consulta.value))

  const items = ref<Clase[]>([])
  const total = ref(0)
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA_CLASES)))

  function filtrosParaApi(): FiltrosClases {
    const id = Number(sede.value)
    return {
      tipo: consulta.value.tipo || undefined,
      sedeId: sede.value && Number.isInteger(id) ? id : undefined,
    }
  }

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
      const lista = await servicio.listar(filtrosParaApi(), pagina.value, POR_PAGINA_CLASES, controlador.signal)
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
      error.value = mensajeDeError(e, 'No se pudo cargar la agenda de clases.')
    } finally {
      if (numero === ultimaConsulta) cargando.value = false
    }
  }

  // Cualquier cambio de lo que se pide (disciplina, sede, página) vuelve a consultar.
  watch([() => consulta.value.tipo, sede, () => consulta.value.pagina], () => void cargar())

  onScopeDispose(() => {
    clearTimeout(temporizador)
    ultimaConsulta++
    controlador?.abort()
  })

  void cargar()

  return { filtros, pagina, items, total, totalPaginas, cargando, error, parametrosDetalle, recargar: cargar }
}
