import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { comoTexto } from '@/compartido/comoTexto'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { ESTADOS_FILTRO, TIPOS_CONCEPTO, type FiltroEstadoPago } from '../presentacion'
import type { FiltrosPagos, Pago } from '../services/servicioPagos'

export const POR_PAGINA_PAGOS = 10
const ESPERA_BUSQUEDA_MS = 300
// El estado arranca (y vuelve al limpiar) en "Todos los estados"; se manda siempre explícito a la API.
const ESTADO_INICIAL: FiltroEstadoPago = 'TODOS'

function enteroPositivo(texto: string): number | undefined {
  if (!/^\d+$/.test(texto)) return undefined
  const valor = Number(texto)
  return Number.isSafeInteger(valor) && valor > 0 ? valor : undefined
}

interface OpcionesListaPagos {
  // Fija el usuario de la consulta ("Mis pagos"): no es un filtro que se edite ni se limpie. `null` es una sesión sin
  // usuario: no se consulta nada (nunca se pide la lista de todos); sin la opción la lista no se acota a un usuario.
  usuarioId?: number | null
}

export function useListaPagos(opciones: OpcionesListaPagos = {}) {
  const servicio = useServicios().pagos
  const sinUsuario = opciones.usuarioId === null

  // `usuarioId` es el texto del campo "ID de usuario"; el que se manda al contrato es `usuarioIdAplicado`, que lo sigue con una
  // pequeña espera para no consultar en cada dígito.
  const filtros = reactive<{ usuarioId: string; estado: string; tipo: string; desde: string; hasta: string }>({
    usuarioId: '',
    estado: ESTADO_INICIAL,
    tipo: '',
    desde: '',
    hasta: '',
  })
  const usuarioIdAplicado = ref('')
  let temporizadorUsuario: ReturnType<typeof setTimeout> | undefined
  const pagina = ref(1)
  const items = ref<Pago[]>([])
  const total = ref(0)
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA_PAGOS)))
  const filtroInvalido = computed(
    () => Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta),
  )

  // El único punto donde se lee el campo "ID de usuario": un campo type="number" entrega un NÚMERO en runtime (y vacío puede
  // quedar null) aunque el modelo se declare como texto, así que se pasa siempre por `comoTexto`.
  const usuarioIdTexto = computed(() => comoTexto(filtros.usuarioId))

  // Solo los filtros que la persona puede editar: el usuario fijo de "Mis pagos" no cuenta.
  const hayFiltrosActivos = computed(() =>
    Boolean(usuarioIdTexto.value || filtros.estado !== ESTADO_INICIAL || filtros.tipo || filtros.desde || filtros.hasta),
  )

  watch(usuarioIdTexto, (texto) => {
    clearTimeout(temporizadorUsuario)
    temporizadorUsuario = setTimeout(() => {
      usuarioIdAplicado.value = texto
    }, ESPERA_BUSQUEDA_MS)
  })

  function limpiarFiltros() {
    // Al limpiar no se espera: el campo vacío se aplica enseguida.
    clearTimeout(temporizadorUsuario)
    usuarioIdAplicado.value = ''
    filtros.usuarioId = ''
    filtros.estado = ESTADO_INICIAL
    filtros.tipo = ''
    filtros.desde = ''
    filtros.hasta = ''
  }

  function filtrosParaApi(): FiltrosPagos {
    const estado = ESTADOS_FILTRO.find((valor) => valor === filtros.estado) ?? ESTADO_INICIAL
    const tipo = TIPOS_CONCEPTO.find((valor) => valor === filtros.tipo)
    // El usuario fijo de "Mis pagos" manda sobre el campo; el texto del campo solo vale si es un entero positivo.
    const usuarioId = typeof opciones.usuarioId === 'number' ? opciones.usuarioId : enteroPositivo(usuarioIdAplicado.value)
    return {
      ...(usuarioId !== undefined ? { usuarioId } : {}),
      estado,
      tipo,
      desde: filtros.desde || undefined,
      hasta: filtros.hasta || undefined,
    }
  }

  let ultimaConsulta = 0
  let controlador: AbortController | undefined

  async function cargar() {
    if (filtroInvalido.value || sinUsuario) {
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
      const lista = await servicio.listar(filtrosParaApi(), pagina.value, POR_PAGINA_PAGOS, controlador.signal)
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
      error.value = mensajeDeError(e, 'No se pudieron cargar los pagos.')
    } finally {
      if (consulta === ultimaConsulta) cargando.value = false
    }
  }

  watch(
    [usuarioIdAplicado, () => filtros.estado, () => filtros.tipo, () => filtros.desde, () => filtros.hasta],
    () => {
      if (pagina.value !== 1) pagina.value = 1
      else void cargar()
    },
  )
  watch(pagina, () => void cargar())
  onScopeDispose(() => {
    clearTimeout(temporizadorUsuario)
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
    filtroInvalido,
    hayFiltrosActivos,
    limpiarFiltros,
    recargar: cargar,
  }
}
