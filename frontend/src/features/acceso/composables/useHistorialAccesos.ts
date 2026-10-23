import { computed, reactive, ref, watch } from 'vue'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { Ingreso } from '../services/servicioAcceso'

const POR_PAGINA = 10
const ESPERA_BUSQUEDA_MS = 300

export interface FiltrosHistorialAccesos {
  sedeId: number | ''
  fecha: string
  nombre: string
  socioId: number | ''
}

export function useHistorialAccesos(sedeInicial?: number | null) {
  const servicioAcceso = useServicios().acceso

  const filtros = reactive<FiltrosHistorialAccesos>({
    sedeId: sedeInicial ?? '',
    fecha: '',
    nombre: '',
    socioId: '',
  })

  const pagina = ref(1)
  const items = ref<Ingreso[]>([])
  const total = ref(0)
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA)))

  const nombreAplicado = ref('')
  let temporizadorNombre: ReturnType<typeof setTimeout> | undefined

  watch(
    () => filtros.nombre,
    (nuevo) => {
      clearTimeout(temporizadorNombre)
      temporizadorNombre = setTimeout(() => {
        nombreAplicado.value = nuevo.trim()
      }, ESPERA_BUSQUEDA_MS)
    },
  )

  let ultimaConsulta = 0
  let controlador: AbortController | undefined

  async function cargar() {
    const consulta = ++ultimaConsulta
    controlador?.abort()
    controlador = new AbortController()

    cargando.value = true
    error.value = null

    try {
      const sedeNum = Number(filtros.sedeId)
      const socioNum = Number(filtros.socioId)

      const respuesta = await servicioAcceso.listarIngresos(
        {
          sedeId: !isNaN(sedeNum) && sedeNum > 0 ? sedeNum : undefined,
          socioId: !isNaN(socioNum) && socioNum > 0 ? socioNum : undefined,
          nombre: nombreAplicado.value || undefined,
          fecha: filtros.fecha || undefined,
          page: pagina.value,
          perPage: POR_PAGINA,
        },
        controlador.signal,
      )

      if (consulta === ultimaConsulta) {
        items.value = respuesta.items
        total.value = respuesta.total
      }
    } catch (e) {
      if (controlador.signal.aborted || consulta !== ultimaConsulta) return
      error.value = mensajeDeError(e, 'No se pudo cargar el historial de accesos.')
      items.value = []
      total.value = 0
    } finally {
      if (consulta === ultimaConsulta) {
        cargando.value = false
      }
    }
  }

  // Al cambiar filtros volvemos a la página 1
  watch(
    [() => filtros.sedeId, () => filtros.fecha, () => filtros.socioId, nombreAplicado],
    () => {
      pagina.value = 1
      void cargar()
    },
  )

  watch(pagina, () => {
    void cargar()
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
    recargar: cargar,
  }
}
