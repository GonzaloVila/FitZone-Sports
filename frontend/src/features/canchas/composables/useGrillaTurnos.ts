import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { Cancha, Disponibilidad } from '../services/servicioCanchas'

const RELOJ_MS = 30_000

export function useGrillaTurnos(canchaId: number, fecha: Ref<string>) {
  const servicio = useServicios().canchas

  const cancha = ref<Cancha | null>(null)
  const cargandoCancha = ref(true)
  const errorCancha = ref<string | null>(null)

  const turnos = ref<Disponibilidad[]>([])
  const cargando = ref(true)
  const error = ref<string | null>(null)

  const ahora = ref(new Date())

  const mantenimiento = computed(() => cancha.value?.estado === 'EN_MANTENIMIENTO')

  let consultaCancha = 0
  let controladorCancha: AbortController | undefined

  async function cargarCancha() {
    const consulta = ++consultaCancha
    controladorCancha?.abort()
    controladorCancha = new AbortController()
    cargandoCancha.value = true
    errorCancha.value = null
    try {
      const resultado = await servicio.obtener(canchaId, controladorCancha.signal)
      if (consulta !== consultaCancha) return
      cancha.value = resultado
    } catch (e) {
      if (consulta !== consultaCancha) return
      cancha.value = null
      errorCancha.value = mensajeDeError(e, 'No se pudo cargar la cancha.')
    } finally {
      if (consulta === consultaCancha) cargandoCancha.value = false
    }
  }

  let ultimaConsulta = 0
  let controlador: AbortController | undefined

  async function cargar() {
    if (!fecha.value) {
      turnos.value = []
      cargando.value = false
      return
    }

    const consulta = ++ultimaConsulta
    controlador?.abort()
    controlador = new AbortController()
    cargando.value = true
    error.value = null
    try {
      const lista = await servicio.consultarDisponibilidad(canchaId, fecha.value, controlador.signal)
      if (consulta !== ultimaConsulta) return
      turnos.value = lista.items
    } catch (e) {
      if (consulta !== ultimaConsulta) return
      turnos.value = []
      error.value = mensajeDeError(e, 'No se pudo cargar la grilla de turnos.')
    } finally {
      if (consulta === ultimaConsulta) cargando.value = false
    }
  }

  // El reloj hace que un turno que va empezando salga de la lista sin recargar.
  const reloj = setInterval(() => {
    ahora.value = new Date()
  }, RELOJ_MS)

  watch(fecha, () => void cargar())
  onScopeDispose(() => {
    clearInterval(reloj)
    consultaCancha++
    ultimaConsulta++
    controladorCancha?.abort()
    controlador?.abort()
  })
  void cargarCancha()
  void cargar()

  return {
    cancha,
    cargandoCancha,
    errorCancha,
    mantenimiento,
    turnos,
    cargando,
    error,
    ahora,
    recargar: cargar,
  }
}
