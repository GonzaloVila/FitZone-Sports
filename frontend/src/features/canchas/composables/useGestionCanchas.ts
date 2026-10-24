import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { TIPOS_CANCHA } from '../presentacion'
import type { Cancha, CanchaPatch, TipoCancha } from '../services/servicioCanchas'

export function useGestionCanchas() {
  const servicio = useServicios().canchas
  const { sedeId: sedeSesion } = useUsuarioSesion()
  const { sedes, cargando: cargandoSedes, error: errorSedes } = useSedes()

  const sede = ref(sedeSesion.value !== null ? String(sedeSesion.value) : '')
  const items = ref<Cancha[]>([])
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const guardando = ref(false)
  const errorFormulario = ref<string | null>(null)
  const exito = ref<string | null>(null)

  const nuevo = reactive({ tipo: 'PADDLE', costoPorHora: '' })

  const sedeElegida = computed<number | null>(() => {
    const id = Number(sede.value)
    return Number.isInteger(id) && id > 0 ? id : null
  })

  let ultimaConsulta = 0
  let controlador: AbortController | undefined

  async function cargar() {
    const idSede = sedeElegida.value
    if (idSede === null) {
      items.value = []
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
      const lista = await servicio.listar(idSede, {}, 1, 100, controlador.signal)
      if (consulta !== ultimaConsulta) return
      items.value = lista.items
    } catch (e) {
      if (consulta !== ultimaConsulta) return
      items.value = []
      error.value = mensajeDeError(e, 'No se pudieron cargar las canchas.')
    } finally {
      if (consulta === ultimaConsulta) cargando.value = false
    }
  }

  watch(sede, () => void cargar())
  onScopeDispose(() => {
    ultimaConsulta++
    controlador?.abort()
  })
  void cargar()

  async function crear(): Promise<boolean> {
    if (guardando.value) return false
    const idSede = sedeElegida.value
    if (idSede === null) {
      errorFormulario.value = 'Elegí la sede de la cancha.'
      return false
    }
    const tipo: TipoCancha | undefined = TIPOS_CANCHA.find((valor) => valor === nuevo.tipo)
    if (!tipo) {
      errorFormulario.value = 'Elegí el deporte de la cancha.'
      return false
    }
    const costo = Number(nuevo.costoPorHora)
    if (!Number.isFinite(costo) || costo < 0) {
      errorFormulario.value = 'Ingresá un costo por hora válido.'
      return false
    }

    guardando.value = true
    errorFormulario.value = null
    exito.value = null
    try {
      await servicio.crear(idSede, { tipo, costoPorHora: costo, estado: 'OPERATIVA' })
      nuevo.costoPorHora = ''
      exito.value = 'Cancha creada.'
      await cargar()
      return true
    } catch (e) {
      errorFormulario.value = mensajeDeError(e, 'No se pudo crear la cancha.')
      return false
    } finally {
      guardando.value = false
    }
  }

  async function modificar(canchaId: number, cambios: CanchaPatch): Promise<boolean> {
    if (guardando.value) return false
    guardando.value = true
    errorFormulario.value = null
    exito.value = null
    try {
      await servicio.modificar(canchaId, cambios)
      exito.value = 'Cancha actualizada.'
      await cargar()
      return true
    } catch (e) {
      errorFormulario.value = mensajeDeError(e, 'No se pudo actualizar la cancha.')
      return false
    } finally {
      guardando.value = false
    }
  }

  function alternarMantenimiento(cancha: Cancha): Promise<boolean> {
    return modificar(cancha.id, {
      estado: cancha.estado === 'OPERATIVA' ? 'EN_MANTENIMIENTO' : 'OPERATIVA',
    })
  }

  function cambiarCosto(cancha: Cancha, costoPorHora: number): Promise<boolean> {
    if (!Number.isFinite(costoPorHora) || costoPorHora < 0) {
      errorFormulario.value = 'Ingresá un costo por hora válido.'
      return Promise.resolve(false)
    }
    return modificar(cancha.id, { costoPorHora })
  }

  function limpiarMensajes() {
    errorFormulario.value = null
    exito.value = null
  }

  return {
    sedes,
    cargandoSedes,
    errorSedes,
    sede,
    items,
    cargando,
    error,
    guardando,
    errorFormulario,
    exito,
    nuevo,
    crear,
    alternarMantenimiento,
    cambiarCosto,
    limpiarMensajes,
  }
}
