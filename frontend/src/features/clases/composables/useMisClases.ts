import { computed, onScopeDispose, ref } from 'vue'
import { mensajeDeError } from '@/compartido/http/errores'
import { useActualizacionPeriodica } from '@/compartido/composables/useActualizacionPeriodica'
import { useServicios } from '@/compartido/servicios'
import { useDescargaPdf } from '@/features/pagos/composables/useDescargaPdf'
import type { Pago } from '@/features/pagos/services/servicioPagos'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { formatearMonto } from '../presentacion'
import { traducirErrorCancelacion, traducirErrorConfirmacion, traducirErrorSalidaDeEspera } from '../errores'
import type { Clase, EsperaClase, ReservaClase } from '../services/servicioClases'
import type { FilaEspera, FilaReserva } from '../tipos'

// Actualización cada pocos segundos mientras la pantalla está abierta (el front no tiene canal de notificaciones).
const INTERVALO_ACTUALIZACION_MS = 5000
const POR_PAGINA = 100

export function useMisClases() {
  const servicios = useServicios()
  const servicio = servicios.clases
  const { socioId } = useUsuarioSesion()

  const proximas = ref<FilaReserva[]>([])
  const pasadas = ref<FilaReserva[]>([])
  const esperas = ref<FilaEspera[]>([])
  const ahora = ref(Date.now())

  const cargando = ref(true)
  const error = ref<string | null>(null)

  const accionando = ref(false)
  const errorAccion = ref<string | null>(null)
  const exitoAccion = ref<string | null>(null)

  const pagoPenalidad = ref<Pago | null>(null)
  const {
    descargando: descargandoComprobante,
    error: errorDescarga,
    descargar,
  } = useDescargaPdf()

  // Descarte de respuestas viejas.
  let ultimaCarga = 0
  let controlador: AbortController | undefined

  // Trae cada clase una sola vez por carga; una que no se pueda leer queda en null y la fila lo avisa.
  async function cargarClases(ids: number[], signal: AbortSignal): Promise<Map<number, Clase | null>> {
    const unicos = [...new Set(ids)]
    const pares = await Promise.all(
      unicos.map(async (id): Promise<[number, Clase | null]> => {
        try {
          return [id, await servicio.obtener(id, signal)]
        } catch (e) {
          if (signal.aborted) throw e
          return [id, null]
        }
      }),
    )
    return new Map(pares)
  }

  async function posicionDe(espera: EsperaClase, signal: AbortSignal): Promise<number | null> {
    try {
      const cola = await servicio.listarEsperaDeClase(espera.claseId, 1, POR_PAGINA, signal)
      const lugar = cola.items.findIndex((item) => item.id === espera.id)
      return lugar >= 0 ? lugar + 1 : null
    } catch (e) {
      if (signal.aborted) throw e
      return null
    }
  }

  async function cargar() {
    const id = socioId.value
    if (id === null) {
      cargando.value = false
      return
    }
    const carga = ++ultimaCarga
    controlador?.abort()
    controlador = new AbortController()
    const { signal } = controlador

    try {
      // Sin estado el contrato trae solo las confirmadas: las canceladas se piden aparte para el historial.
      const [confirmadas, canceladas, listaEsperas] = await Promise.all([
        servicio.listarReservas({ socioId: id }, 1, POR_PAGINA, signal),
        servicio.listarReservas({ socioId: id, estado: 'CANCELADA' }, 1, POR_PAGINA, signal),
        servicio.listarEsperas({ socioId: id }, 1, POR_PAGINA, signal),
      ])
      const reservas: ReservaClase[] = [...confirmadas.items, ...canceladas.items]
      const clases = await cargarClases(
        [...reservas.map((r) => r.claseId), ...listaEsperas.items.map((e) => e.claseId)],
        signal,
      )
      const filasEspera: FilaEspera[] = await Promise.all(
        listaEsperas.items.map(async (espera) => ({
          espera,
          clase: clases.get(espera.claseId) ?? null,
          posicion: await posicionDe(espera, signal),
        })),
      )
      if (carga !== ultimaCarga) return

      const filas: FilaReserva[] = reservas.map((reserva) => ({ reserva, clase: clases.get(reserva.claseId) ?? null }))
      const inicio = (fila: FilaReserva) => (fila.clase ? new Date(fila.clase.horarioInicio).getTime() : 0)
      // El estado "cumplida" lo calcula el servidor: el front solo separa por lo que llega.
      proximas.value = filas.filter((f) => f.reserva.estado === 'CONFIRMADA').sort((a, b) => inicio(a) - inicio(b))
      pasadas.value = filas.filter((f) => f.reserva.estado !== 'CONFIRMADA').sort((a, b) => inicio(b) - inicio(a))
      esperas.value = filasEspera
      ahora.value = Date.now()
      error.value = null
    } catch (e) {
      if (carga !== ultimaCarga) return
      error.value = mensajeDeError(e, 'No se pudieron cargar tus clases.')
    } finally {
      if (carga === ultimaCarga) cargando.value = false
    }
  }

  useActualizacionPeriodica(cargar, { intervaloMs: INTERVALO_ACTUALIZACION_MS })

  onScopeDispose(() => {
    ultimaCarga++
    controlador?.abort()
  })

  async function ejecutar(accion: () => Promise<void>, exito: string, traducir: (e: unknown) => string): Promise<boolean> {
    if (accionando.value) return false
    accionando.value = true
    errorAccion.value = null
    exitoAccion.value = null
    pagoPenalidad.value = null
    let ok = false
    try {
      await accion()
      exitoAccion.value = exito
      ok = true
    } catch (e) {
      errorAccion.value = traducir(e)
    } finally {
      await cargar()
      accionando.value = false
    }
    return ok
  }

  async function cancelarReserva(reservaId: number): Promise<boolean> {
    const ok = await ejecutar(() => servicio.cancelarReserva(reservaId), 'Reserva cancelada.', traducirErrorCancelacion)
    if (!ok) return false

    try {
      const pagos = await servicios.pagos.listar({ reservaClaseId: reservaId }, 1, 1)
      const pago = pagos.items[0] ?? null
      pagoPenalidad.value = pago
      if (pago) {
        exitoAccion.value = `Reserva cancelada. Se cobró una penalidad de ${formatearMonto(pago.monto)}.`
      }
    } catch {
      pagoPenalidad.value = null
    }
    return true
  }

  function descargarComprobantePenalidad(): Promise<boolean> {
    const pago = pagoPenalidad.value
    if (!pago) return Promise.resolve(false)
    return descargar(`comprobante-penalidad-${pago.id}.pdf`, () => servicios.pagos.descargarComprobante(pago.id))
  }

  const confirmarCupo = (esperaId: number) =>
    ejecutar(
      async () => {
        await servicio.confirmarEspera(esperaId)
      },
      'Cupo confirmado. Tu reserva quedó registrada.',
      traducirErrorConfirmacion,
    )

  const salirDeEspera = (esperaId: number) =>
    ejecutar(() => servicio.salirDeEspera(esperaId), 'Saliste de la lista de espera.', traducirErrorSalidaDeEspera)

  const sinSocio = computed(() => socioId.value === null)

  return {
    proximas,
    pasadas,
    esperas,
    ahora,
    cargando,
    error,
    accionando,
    errorAccion,
    exitoAccion,
    pagoPenalidad,
    descargandoComprobante,
    errorDescarga,
    sinSocio,
    cancelarReserva,
    descargarComprobantePenalidad,
    confirmarCupo,
    salirDeEspera,
  }
}
