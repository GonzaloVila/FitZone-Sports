import { computed, onScopeDispose, reactive, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import {
  leerConsultaCanchas,
  parametrosDeConsultaCanchas,
  parametrosDesdeCanchas,
  sinParametrosDeCanchas,
  type ConsultaCanchas,
} from '../direccion'
import { ESTADOS_CANCHA, TIPOS_CANCHA } from '../presentacion'
import type { Cancha, FiltrosCanchas } from '../services/servicioCanchas'

export const POR_PAGINA_CANCHAS = 12

// Los filtros (deporte, sede y estado) y la página viven en la dirección, junto con la vista: sobreviven a ir a la pantalla
// de turnos y volver, a recargar y a compartir el enlace. Cada cambio reemplaza la entrada del historial (Atrás no recorre
// cada selección). Los filtros y la paginación los resuelve el servidor (GET /canchas).
// El deporte es el `tipo` de la cancha (un solo valor, validado contra TIPOS_CANCHA; uno desconocido se ignora).
// Un parámetro ausente es el valor por defecto: "Todas las sedes" para el GERENTE, el SOCIO y el EXTERNO, y la sede del token
// para el RECEPCION (fija, sin selector: un ?sede= de la dirección no la cambia). `sedePorDefecto` solo lo pasa la pantalla
// para un RECEPCION sin sede en el token (su sede activa); puede llegar después, cuando terminan de cargar las sedes.
// "Todas las sedes" elegida a propósito se escribe en la dirección y no vuelve sola a la sede por defecto.
export function useCanchas(sedePorDefecto?: MaybeRefOrGetter<number | null>) {
  const servicio = useServicios().canchas
  const { sedeId } = useUsuarioSesion()
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

  const sedePorDefectoTexto = computed(() => {
    const id = toValue(sedePorDefecto) ?? null
    return id === null ? '' : String(id)
  })
  // '' = todas las sedes.
  const sede = computed(() => (sedeId.value !== null ? String(sedeId.value) : (consulta.value.sede ?? sedePorDefectoTexto.value)))

  function actualizar(cambios: Partial<ConsultaCanchas>) {
    const siguiente = { ...consulta.value, ...cambios }
    void router.replace({ query: { ...sinParametrosDeCanchas(route.query), ...parametrosDeConsultaCanchas(siguiente) } })
  }

  // Cambiar un filtro vuelve a la página 1.
  const filtros = reactive({
    tipo: computed({
      get: () => consulta.value.tipo,
      set: (valor: string) => actualizar({ tipo: valor, pagina: 1 }),
    }),
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

  // Hay un filtro puesto si el deporte o el estado no son "todos" o se eligió una sede concreta. La sede fija del RECEPCION
  // (la del token) y la sede por defecto no cuentan: no las eligió la persona.
  const hayFiltrosActivos = computed(
    () =>
      consulta.value.tipo !== '' ||
      consulta.value.estado !== '' ||
      (sedeId.value === null && consulta.value.sede !== null && consulta.value.sede !== ''),
  )

  // Deja la lista como recién abierta: sin deporte ni estado, la sede por defecto y la página 1.
  function limpiarFiltros() {
    actualizar({ tipo: '', estado: '', sede: null, pagina: 1 })
  }

  // Los parámetros con los que la grilla de turnos reconstruye esta lista al volver.
  const parametrosDetalle = computed(() => parametrosDesdeCanchas(consulta.value))

  const items = ref<Cancha[]>([])
  const total = ref(0)
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA_CANCHAS)))

  function filtrosParaApi(): FiltrosCanchas {
    const id = Number(sede.value)
    return {
      sedeId: sede.value && Number.isInteger(id) ? id : undefined,
      tipo: TIPOS_CANCHA.find((valor) => valor === consulta.value.tipo),
      estado: ESTADOS_CANCHA.find((valor) => valor === consulta.value.estado),
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
      const lista = await servicio.buscar(filtrosParaApi(), pagina.value, POR_PAGINA_CANCHAS, controlador.signal)
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

  // Cualquier cambio de lo que se pide (sede, deporte, estado, página) vuelve a consultar.
  watch([sede, () => consulta.value.tipo, () => consulta.value.estado, () => consulta.value.pagina], () => void cargar())

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
    hayFiltrosActivos,
    limpiarFiltros,
    parametrosDetalle,
    recargar: cargar,
  }
}
