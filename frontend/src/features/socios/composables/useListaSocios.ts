import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { useAvisosFz } from '@/ui'
import { ESTADOS, PLANES } from '../presentacion'
import type { FiltrosSocios, Membresia } from '../services/servicioSocios'
import type { FilaSocio, FiltrosListaSocios } from '../tipos'

const POR_PAGINA = 10
const ESPERA_BUSQUEDA_MS = 300
// Máximo de membresías pedidas en paralelo (una por fila de la página).
const CONCURRENCIA_MEMBRESIAS = 4

export function useListaSocios() {
  const servicio = useServicios().socios
  const avisos = useAvisosFz()

  const filtros = reactive<FiltrosListaSocios>({ nombre: '', estado: '', plan: '', sede: '' })
  const pagina = ref(1)
  const items = ref<FilaSocio[]>([])
  const total = ref(0)
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA)))
  // Ids de los socios cuya renovación automática se está guardando.
  const guardandoRenovacion = reactive(new Set<number>())

  // El nombre se aplica con debounce; el resto de los filtros, de inmediato.
  const nombreAplicado = ref('')
  let temporizador: ReturnType<typeof setTimeout> | undefined
  watch(
    () => filtros.nombre,
    (nombre) => {
      clearTimeout(temporizador)
      temporizador = setTimeout(() => {
        nombreAplicado.value = nombre.trim()
      }, ESPERA_BUSQUEDA_MS)
    },
  )

  // Los valores de los selects se validan contra el contrato; uno desconocido equivale a "todos".
  function filtrosParaApi(): FiltrosSocios {
    const sedeId = Number(filtros.sede)
    return {
      nombre: nombreAplicado.value || undefined,
      estadoMembresia: ESTADOS.find((estado) => estado === filtros.estado),
      plan: PLANES.find((plan) => plan === filtros.plan),
      sedeOrigenId: filtros.sede && Number.isInteger(sedeId) ? sedeId : undefined,
    }
  }

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
      const lista = await servicio.listar(filtrosParaApi(), pagina.value, POR_PAGINA, signal)
      if (consulta !== ultimaConsulta) return

      total.value = lista.total
      // Si la página pedida quedó fuera de rango (por ejemplo, se borraron socios), se vuelve a la última.
      if (lista.items.length === 0 && lista.total > 0 && pagina.value > totalPaginas.value) {
        pagina.value = totalPaginas.value
        return
      }
      items.value = lista.items.map((socio) => ({ socio, membresia: { situacion: 'cargando' } }))
      cargando.value = false
      await cargarMembresias(consulta, signal)
    } catch (e) {
      if (consulta !== ultimaConsulta) return
      items.value = []
      total.value = 0
      error.value = mensajeDeError(e, 'No se pudo cargar el listado de socios.')
    } finally {
      if (consulta === ultimaConsulta) cargando.value = false
    }
  }

  // Limitación del contrato: SocioOut no trae plan ni estado, así que se pide la membresía de cada fila de la
  // página con concurrencia limitada. Si una falla, solo esa fila queda "no disponible".
  async function cargarMembresias(consulta: number, signal: AbortSignal) {
    let siguiente = 0

    async function trabajador() {
      while (consulta === ultimaConsulta && siguiente < items.value.length) {
        const indice = siguiente++
        const socioId = items.value[indice]?.socio.id
        if (socioId === undefined) return
        let resultado: FilaSocio['membresia']
        try {
          resultado = { situacion: 'disponible', membresia: await servicio.obtenerMembresia(socioId, signal) }
        } catch {
          resultado = { situacion: 'no-disponible' }
        }
        // Si mientras tanto hubo otra consulta, esta respuesta es vieja y se descarta.
        if (consulta !== ultimaConsulta) return
        const fila = items.value[indice]
        if (fila) fila.membresia = resultado
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCIA_MEMBRESIAS }, trabajador))
  }

  const hayFiltrosActivos = computed(() =>
    Boolean(filtros.nombre.trim() || filtros.estado || filtros.plan || filtros.sede),
  )

  function limpiarFiltros() {
    // El nombre se aplica sin esperar el debounce: limpiar es una acción explícita.
    clearTimeout(temporizador)
    nombreAplicado.value = ''
    filtros.nombre = ''
    filtros.estado = ''
    filtros.plan = ''
    filtros.sede = ''
  }

  // Actualiza la fila de esa página con lo que devolvió el servidor, sin volver a consultar el listado.
  function reemplazarMembresia(socioId: number, membresia: Membresia) {
    const fila = items.value.find((candidata) => candidata.socio.id === socioId)
    if (fila) fila.membresia = { situacion: 'disponible', membresia }
  }

  // Vuelve a consultar la página actual (por ejemplo, después de una baja). Una respuesta vieja se descarta igual.
  function recargar() {
    return cargar()
  }

  // Se guarda al tocar el interruptor y la fila se actualiza con lo que devuelve el servidor. Si falla, la fila
  // no cambia (el interruptor vuelve solo a su estado anterior) y sale un aviso.
  async function alternarRenovacion(socioId: number) {
    const fila = items.value.find((candidata) => candidata.socio.id === socioId)
    if (!fila || fila.membresia.situacion !== 'disponible' || guardandoRenovacion.has(socioId)) return
    const consulta = ultimaConsulta
    guardandoRenovacion.add(socioId)
    try {
      const actualizada = await servicio.modificarMembresia(socioId, {
        renuevaAutomatica: !fila.membresia.membresia.renuevaAutomatica,
      })
      // Si cambió la consulta o la fila ya no está, el resultado no aplica.
      if (consulta !== ultimaConsulta) return
      reemplazarMembresia(socioId, actualizada)
    } catch (e) {
      if (consulta !== ultimaConsulta) return
      avisos.error(mensajeDeError(e, 'No se pudo cambiar la renovación automática.'))
    } finally {
      guardandoRenovacion.delete(socioId)
    }
  }

  // Cambiar un filtro vuelve a la página 1; si ya estaba en la 1, recarga directamente.
  watch([nombreAplicado, () => filtros.estado, () => filtros.plan, () => filtros.sede], () => {
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

  return {
    filtros,
    pagina,
    porPagina: POR_PAGINA,
    items,
    total,
    totalPaginas,
    cargando,
    error,
    hayFiltrosActivos,
    limpiarFiltros,
    alternarRenovacion,
    guardandoRenovacion,
    reemplazarMembresia,
    recargar,
  }
}
