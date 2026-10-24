import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { Cancha, Disponibilidad, ReservaCancha } from '../services/servicioCanchas'

const RELOJ_MS = 30_000
const POR_PAGINA = 100

export function useGrillaTurnos(canchaId: number, fecha: Ref<string>) {
  const servicio = useServicios().canchas

  const cancha = ref<Cancha | null>(null)
  const cargandoCancha = ref(true)
  const errorCancha = ref<string | null>(null)

  const turnos = ref<Disponibilidad[]>([])
  const cargando = ref(true)
  const error = ref<string | null>(null)

  const reservasDelDia = ref<ReservaCancha[]>([])
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

  let ultimaConsultaReservas = 0
  let controladorReservas: AbortController | undefined

  async function cargarReservas() {
    if (!mantenimiento.value || !fecha.value) {
      reservasDelDia.value = []
      return
    }

    const consulta = ++ultimaConsultaReservas
    controladorReservas?.abort()
    controladorReservas = new AbortController()
    const { signal } = controladorReservas
    try {
      const [confirmadas, cumplidas] = await Promise.all([
        servicio.listarReservas({ canchaId, fecha: fecha.value }, 1, POR_PAGINA, signal),
        servicio.listarReservas({ canchaId, fecha: fecha.value, estado: 'CUMPLIDA' }, 1, POR_PAGINA, signal),
      ])
      if (consulta !== ultimaConsultaReservas) return
      reservasDelDia.value = [...confirmadas.items, ...cumplidas.items]
    } catch {
      if (consulta === ultimaConsultaReservas) reservasDelDia.value = []
    }
  }

  const reloj = setInterval(() => {
    ahora.value = new Date()
  }, RELOJ_MS)

  watch(fecha, () => void cargar())
  watch([fecha, mantenimiento], () => void cargarReservas(), { immediate: true })
  onScopeDispose(() => {
    clearInterval(reloj)
    consultaCancha++
    ultimaConsulta++
    ultimaConsultaReservas++
    controladorCancha?.abort()
    controlador?.abort()
    controladorReservas?.abort()
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
    reservasDelDia,
    recargar: cargar,
  }
}
