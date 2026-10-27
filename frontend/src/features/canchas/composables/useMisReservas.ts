import { computed, onScopeDispose, ref, watch } from 'vue'
import { useActualizacionPeriodica } from '@/compartido/composables/useActualizacionPeriodica'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { mensajeCancelacion } from '../errores'
import type { EstadoReserva } from '../services/servicioCanchas'
import type { FilaReserva } from '../tipos'

const POR_PAGINA = 100
const CONCURRENCIA_PAGOS = 4
const RELOJ_MS = 30_000
const REFRESCO_MS = 60_000

export function useMisReservas() {
  const servicios = useServicios()
  const { usuarioId } = useUsuarioSesion()

  const pestana = ref('proximas')
  const filas = ref<FilaReserva[]>([])
  const cargando = ref(true)
  const error = ref<string | null>(null)
  const accionando = ref(false)
  const errorAccion = ref<string | null>(null)
  const exitoAccion = ref<string | null>(null)
  const ahora = ref(Date.now())

  const estadoDePestana = computed<EstadoReserva | undefined>(() => {
    if (pestana.value === 'canceladas') return 'CANCELADA'
    if (pestana.value === 'pasadas') return 'CUMPLIDA'
    return undefined
  })

  let ultimaConsulta = 0
  let controlador: AbortController | undefined

  async function cargarPagos(signal: AbortSignal) {
    let siguiente = 0
    async function trabajador() {
      while (siguiente < filas.value.length) {
        const fila = filas.value[siguiente++]
        if (!fila) return
        try {
          const pagos = await servicios.pagos.listar({ reservaCanchaId: fila.reserva.id }, 1, 1, signal)
          if (!signal.aborted) fila.pago = pagos.total > 0 ? 'pagada' : 'pendiente'
        } catch {
          if (!signal.aborted) fila.pago = 'sin-dato'
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCIA_PAGOS }, trabajador))
  }

  async function cargar() {
    const id = usuarioId.value
    if (id === null) {
      filas.value = []
      cargando.value = false
      return
    }

    const consulta = ++ultimaConsulta
    controlador?.abort()
    controlador = new AbortController()
    const { signal } = controlador
    cargando.value = true
    error.value = null
    try {
      const lista = await servicios.canchas.listarReservas(
        { usuarioId: id, estado: estadoDePestana.value },
        1,
        POR_PAGINA,
        signal,
      )
      if (consulta !== ultimaConsulta) return
      filas.value = lista.items.map((reserva) => ({ reserva, pago: 'cargando' }))
      await cargarPagos(signal)
    } catch (e) {
      if (consulta !== ultimaConsulta) return
      filas.value = []
      error.value = mensajeDeError(e, 'No se pudieron cargar tus reservas.')
    } finally {
      if (consulta === ultimaConsulta) cargando.value = false
    }
  }

  watch(pestana, () => void cargar())
  useActualizacionPeriodica(cargar, { intervaloMs: REFRESCO_MS, inmediato: false })

  const reloj = setInterval(() => {
    ahora.value = Date.now()
  }, RELOJ_MS)

  onScopeDispose(() => {
    clearInterval(reloj)
    ultimaConsulta++
    controlador?.abort()
  })
  void cargar()

  async function cancelar(fila: FilaReserva): Promise<boolean> {
    if (accionando.value) return false
    accionando.value = true
    errorAccion.value = null
    exitoAccion.value = null
    try {
      await servicios.canchas.cancelarReserva(fila.reserva.id)
      exitoAccion.value = 'Reserva cancelada.'
      return true
    } catch (e) {
      errorAccion.value = mensajeCancelacion(e)
      return false
    } finally {
      await cargar()
      accionando.value = false
    }
  }

  const sinUsuario = computed(() => usuarioId.value === null)

  // Quien abre el modal de cancelación arranca sin el resultado de una acción anterior.
  function limpiarMensajes() {
    errorAccion.value = null
    exitoAccion.value = null
  }

  return {
    limpiarMensajes,
    pestana,
    filas,
    cargando,
    error,
    accionando,
    errorAccion,
    exitoAccion,
    ahora,
    sinUsuario,
    cancelar,
  }
}
