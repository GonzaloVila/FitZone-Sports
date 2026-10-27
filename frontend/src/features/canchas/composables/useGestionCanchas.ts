import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { mensajeCancha } from '../errores'
import type { Cancha, CanchaPatch } from '../services/servicioCanchas'

const POR_PAGINA = 100

// Canchas de una sede para el GERENTE: costo por hora y mantenimiento. El alta va aparte (useAltaCancha, en un modal).
// `sedeId` es la sede que se está mirando (la activa); null = todavía ninguna.
export function useGestionCanchas(sedeId: MaybeRefOrGetter<number | null>) {
  const servicio = useServicios().canchas

  const items = ref<Cancha[]>([])
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const guardando = ref(false)
  const errorAccion = ref<string | null>(null)
  const exito = ref<string | null>(null)

  const sedeElegida = computed(() => toValue(sedeId))

  // Descarte de respuestas viejas: cada consulta tiene un número y su propio AbortController.
  let ultimaConsulta = 0
  let controlador: AbortController | undefined

  async function cargar() {
    const numero = ++ultimaConsulta
    controlador?.abort()
    const idSede = sedeElegida.value
    if (idSede === null) {
      items.value = []
      error.value = null
      cargando.value = false
      return
    }

    controlador = new AbortController()
    cargando.value = true
    error.value = null
    try {
      const lista = await servicio.listar(idSede, {}, 1, POR_PAGINA, controlador.signal)
      if (numero !== ultimaConsulta) return
      items.value = lista.items
    } catch (e) {
      if (numero !== ultimaConsulta) return
      items.value = []
      error.value = mensajeDeError(e, 'No se pudieron cargar las canchas.')
    } finally {
      if (numero === ultimaConsulta) cargando.value = false
    }
  }

  // Cambiar de sede deja atrás los mensajes de la anterior.
  watch(sedeElegida, () => {
    limpiarMensajes()
    void cargar()
  })
  onScopeDispose(() => {
    ultimaConsulta++
    controlador?.abort()
  })
  void cargar()

  async function modificar(canchaId: number, cambios: CanchaPatch, textoExito: string): Promise<boolean> {
    if (guardando.value) return false
    guardando.value = true
    limpiarMensajes()
    try {
      await servicio.modificar(canchaId, cambios)
      exito.value = textoExito
      await cargar()
      return true
    } catch (e) {
      errorAccion.value = mensajeCancha(e, 'No se pudo actualizar la cancha.')
      return false
    } finally {
      guardando.value = false
    }
  }

  function alternarMantenimiento(cancha: Cancha): Promise<boolean> {
    const aMantenimiento = cancha.estado === 'OPERATIVA'
    return modificar(
      cancha.id,
      { estado: aMantenimiento ? 'EN_MANTENIMIENTO' : 'OPERATIVA' },
      aMantenimiento ? 'La cancha pasó a mantenimiento.' : 'La cancha volvió a estar operativa.',
    )
  }

  function cambiarCosto(cancha: Cancha, costoPorHora: number): Promise<boolean> {
    if (!Number.isFinite(costoPorHora) || costoPorHora < 0) {
      limpiarMensajes()
      errorAccion.value = 'Ingresá un costo por hora de cero o más.'
      return Promise.resolve(false)
    }
    return modificar(cancha.id, { costoPorHora }, 'Costo por hora actualizado.')
  }

  function limpiarMensajes() {
    errorAccion.value = null
    exito.value = null
  }

  return {
    items,
    cargando,
    error,
    guardando,
    errorAccion,
    exito,
    alternarMantenimiento,
    cambiarCosto,
    limpiarMensajes,
    recargar: cargar,
  }
}
