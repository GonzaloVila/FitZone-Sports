import { computed, onScopeDispose, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useActualizacionPeriodica } from '@/compartido/composables/useActualizacionPeriodica'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import {
  leerConsultaMisReservas,
  parametrosDeConsultaMisReservas,
  sinParametrosDeMisReservas,
  type ConsultaMisReservas,
} from '../direccion'
import { mensajeCancelacion } from '../errores'
import type { PestanaReservas } from '../presentacion'
import type { EstadoReserva } from '../services/servicioCanchas'
import type { FilaReserva } from '../tipos'

export const POR_PAGINA_RESERVAS = 12
const CONCURRENCIA_PAGOS = 4
const RELOJ_MS = 30_000
const REFRESCO_MS = 60_000

// Las reservas del usuario de la sesión, una pestaña a la vez (Próximas, Canceladas o Pasadas), paginadas en el servidor.
// La pestaña y la página viven en la dirección (?pestana=, ?pagina-reservas=): sobreviven a recargar y a volver de la pantalla
// de turnos. Cada cambio reemplaza la entrada del historial y cambiar de pestaña vuelve a la página 1.
export function useMisReservas() {
  const servicios = useServicios()
  const { usuarioId } = useUsuarioSesion()
  const route = useRoute()
  const router = useRouter()

  const consulta = computed(() => leerConsultaMisReservas(route.query))

  function actualizar(cambios: Partial<ConsultaMisReservas>) {
    const siguiente = { ...consulta.value, ...cambios }
    void router.replace({ query: { ...sinParametrosDeMisReservas(route.query), ...parametrosDeConsultaMisReservas(siguiente) } })
  }

  const pestana = computed({
    get: (): PestanaReservas => consulta.value.pestana,
    set: (valor: string) => {
      const elegida = valor === 'canceladas' || valor === 'pasadas' ? valor : 'proximas'
      actualizar({ pestana: elegida, pagina: 1 })
    },
  })
  const pagina = computed({
    get: () => consulta.value.pagina,
    set: (numero: number) => actualizar({ pagina: numero }),
  })

  const filas = ref<FilaReserva[]>([])
  const total = ref(0)
  const cargando = ref(true)
  const error = ref<string | null>(null)
  const accionando = ref(false)
  const errorAccion = ref<string | null>(null)
  const exitoAccion = ref<string | null>(null)
  const ahora = ref(Date.now())

  const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA_RESERVAS)))

  // Próximas es el listado por defecto del servidor (confirmadas activas): no lleva estado.
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
      total.value = 0
      cargando.value = false
      return
    }

    const consultaActual = ++ultimaConsulta
    controlador?.abort()
    controlador = new AbortController()
    const { signal } = controlador
    cargando.value = true
    error.value = null
    try {
      const lista = await servicios.canchas.listarReservas(
        { usuarioId: id, estado: estadoDePestana.value },
        pagina.value,
        POR_PAGINA_RESERVAS,
        signal,
      )
      if (consultaActual !== ultimaConsulta) return

      total.value = lista.total
      // Si la página pedida quedó fuera de rango (por ejemplo, se canceló la última reserva de la última página), se vuelve a
      // la última; el cambio de página vuelve a consultar.
      if (lista.items.length === 0 && lista.total > 0 && pagina.value > totalPaginas.value) {
        pagina.value = totalPaginas.value
        return
      }
      filas.value = lista.items.map((reserva) => ({ reserva, pago: 'cargando' }))
      await cargarPagos(signal)
    } catch (e) {
      if (consultaActual !== ultimaConsulta) return
      filas.value = []
      total.value = 0
      error.value = mensajeDeError(e, 'No se pudieron cargar tus reservas.')
    } finally {
      if (consultaActual === ultimaConsulta) cargando.value = false
    }
  }

  // Cada pestaña tiene sus propias columnas: al cambiar de pestaña no quedan a la vista las filas de la anterior. Cambiar de
  // página sí conserva las filas (la tabla queda ocupada) hasta que llegan las nuevas.
  watch(pestana, () => {
    filas.value = []
  })
  watch([pestana, pagina], () => void cargar())
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
    pagina,
    total,
    totalPaginas,
    filas,
    cargando,
    error,
    accionando,
    errorAccion,
    exitoAccion,
    ahora,
    sinUsuario,
    cancelar,
    recargar: cargar,
  }
}
