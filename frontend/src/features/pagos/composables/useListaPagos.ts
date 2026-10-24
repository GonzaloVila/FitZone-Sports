import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { ESTADOS_PAGO, TIPOS_CONCEPTO } from '../presentacion'
import type { EstadoPago, FiltrosPagos, Pago } from '../services/servicioPagos'

const POR_PAGINA = 10

export function useListaPagos() {
  const servicio = useServicios().pagos

  const filtros = reactive({ estado: '', tipo: '', desde: '', hasta: '' })
  const pagina = ref(1)
  const items = ref<Pago[]>([])
  const total = ref(0)
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA)))
  const filtroInvalido = computed(
    () => Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta),
  )

  function filtrosParaApi(): FiltrosPagos {
    const estado: EstadoPago | undefined = ESTADOS_PAGO.find((valor) => valor === filtros.estado)
    const tipo = TIPOS_CONCEPTO.find((valor) => valor === filtros.tipo)
    return {
      estado,
      tipo,
      desde: filtros.desde || undefined,
      hasta: filtros.hasta || undefined,
    }
  }

  let ultimaConsulta = 0
  let controlador: AbortController | undefined

  async function cargar() {
    if (filtroInvalido.value) {
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
      const lista = await servicio.listar(filtrosParaApi(), pagina.value, POR_PAGINA, controlador.signal)
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
    [() => filtros.estado, () => filtros.tipo, () => filtros.desde, () => filtros.hasta],
    () => {
      if (pagina.value !== 1) pagina.value = 1
      else void cargar()
    },
  )
  watch(pagina, () => void cargar())
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
    filtroInvalido,
    recargar: cargar,
  }
}
