import { computed, onScopeDispose, ref, watch } from 'vue'
import { esErrorApi, mensajeDeError } from '@/compartido/http/errores'
import { useActualizacionPeriodica } from '@/compartido/composables/useActualizacionPeriodica'
import { useServicios } from '@/compartido/servicios'
import { useDescargaPdf } from '@/features/pagos/composables/useDescargaPdf'
import type { Pago } from '@/features/pagos/services/servicioPagos'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { formatearMonto } from '../presentacion'
import {
  traducirErrorCancelacion,
  traducirErrorConfirmacion,
  traducirErrorEspera,
  traducirErrorReserva,
  traducirErrorSalidaDeEspera,
} from '../errores'
import type { Clase, EsperaClase, ReservaClase } from '../services/servicioClases'

// Actualización cada pocos segundos mientras la pantalla está abierta (el servidor notifica la espera, el front no).
const INTERVALO_ACTUALIZACION_MS = 5000
const POR_PAGINA_OCUPACION = 100

// Un id inválido (null) se trata como clase inexistente, sin pedir nada a la API.
export function useDetalleClase(claseId: () => number | null) {
  const servicios = useServicios()
  const servicio = servicios.clases
  const { rol, socioId } = useUsuarioSesion()

  const clase = ref<Clase | null>(null)
  const reserva = ref<ReservaClase | null>(null)
  const espera = ref<EsperaClase | null>(null)
  const posicionEnEspera = ref<number | null>(null)
  const inscriptos = ref<ReservaClase[]>([])
  const listaEspera = ref<EsperaClase[]>([])
  const ahora = ref(Date.now())

  const cargando = ref(true)
  const error = ref<string | null>(null)
  const noExiste = ref(false)

  const accionando = ref(false)
  const errorAccion = ref<string | null>(null)
  const exitoAccion = ref<string | null>(null)
  const reservaCancelada = ref(false)

  // Al cambiar de clase (otro recorrido) se vuelve a habilitar "Reservar".
  watch(claseId, () => {
    reservaCancelada.value = false
  })

  const pagoPenalidad = ref<Pago | null>(null)
  const {
    descargando: descargandoComprobante,
    error: errorDescarga,
    descargar,
  } = useDescargaPdf()

  const esSocio = computed(() => rol.value === 'SOCIO')
  const esPersonal = computed(() => rol.value === 'RECEPCION' || rol.value === 'GERENTE')

  // Descarte de respuestas viejas: cada carga tiene un número y su propio AbortController.
  let ultimaCarga = 0
  let controlador: AbortController | undefined

  async function cargar() {
    const carga = ++ultimaCarga
    controlador?.abort()
    controlador = new AbortController()
    const { signal } = controlador
    const id = claseId()
    if (id === null) {
      noExiste.value = true
      cargando.value = false
      return
    }

    try {
      const claseActual = await servicio.obtener(id, signal)
      let reservaActual: ReservaClase | null = null
      let esperaActual: EsperaClase | null = null
      let posicion: number | null = null
      let inscriptosActuales: ReservaClase[] = []
      let colaActual: EsperaClase[] = []

      if (esSocio.value && socioId.value !== null) {
        const [reservas, esperas] = await Promise.all([
          servicio.listarReservas({ claseId: id, socioId: socioId.value }, 1, 1, signal),
          servicio.listarEsperas({ claseId: id, socioId: socioId.value }, 1, 1, signal),
        ])
        reservaActual = reservas.items[0] ?? null
        esperaActual = esperas.items[0] ?? null
        if (esperaActual) {
          const cola = await servicio.listarEsperaDeClase(id, 1, POR_PAGINA_OCUPACION, signal)
          const lugar = cola.items.findIndex((item) => item.id === esperaActual?.id)
          posicion = lugar >= 0 ? lugar + 1 : null
        }
      } else if (esPersonal.value) {
        const [ocupacion, cola] = await Promise.all([
          servicio.listarInscriptos(id, 1, POR_PAGINA_OCUPACION, signal),
          servicio.listarEsperaDeClase(id, 1, POR_PAGINA_OCUPACION, signal),
        ])
        inscriptosActuales = ocupacion.items
        colaActual = cola.items
      }

      if (carga !== ultimaCarga) return
      clase.value = claseActual
      reserva.value = reservaActual
      espera.value = esperaActual
      posicionEnEspera.value = posicion
      inscriptos.value = inscriptosActuales
      listaEspera.value = colaActual
      ahora.value = Date.now()
      noExiste.value = false
      error.value = null
    } catch (e) {
      if (carga !== ultimaCarga) return
      if (esErrorApi(e) && e.status === 404) {
        noExiste.value = true
        clase.value = null
      } else {
        error.value = mensajeDeError(e, 'No se pudo cargar la clase.')
      }
    } finally {
      if (carga === ultimaCarga) cargando.value = false
    }
  }

  useActualizacionPeriodica(cargar, { intervaloMs: INTERVALO_ACTUALIZACION_MS })

  onScopeDispose(() => {
    ultimaCarga++
    controlador?.abort()
  })

  // Ejecuta una acción y vuelve a pedir la clase para que los cupos sean los del servidor.
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

  async function reservar() {
    const id = socioId.value
    const claseActual = clase.value?.id
    if (id === null || claseActual === undefined) return false
    // Si el cupo se agotó (409), la recarga posterior de la clase deja visible la opción de anotarse en espera.
    return ejecutar(
      async () => {
        await servicio.reservar(claseActual, id)
      },
      'Reserva confirmada. ¡Nos vemos en la clase!',
      traducirErrorReserva,
    )
  }

  async function cancelarReserva() {
    const actual = reserva.value
    if (!actual) return false
    const ok = await ejecutar(() => servicio.cancelarReserva(actual.id), 'Reserva cancelada.', traducirErrorCancelacion)
    if (!ok) return false

    // En esta pantalla ya no se ofrece reservar de nuevo: solo se puede volver y rehacer el recorrido.
    reservaCancelada.value = true

    try {
      const pagos = await servicios.pagos.listar({ reservaClaseId: actual.id }, 1, 1)
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

  async function anotarseEnEspera() {
    const id = socioId.value
    const claseActual = clase.value?.id
    if (id === null || claseActual === undefined) return false
    return ejecutar(
      async () => {
        await servicio.anotarseEnEspera(claseActual, id)
      },
      'Quedaste anotado en la lista de espera.',
      traducirErrorEspera,
    )
  }

  async function confirmarCupo() {
    const actual = espera.value
    if (!actual) return false
    return ejecutar(
      async () => {
        await servicio.confirmarEspera(actual.id)
      },
      'Cupo confirmado. Tu reserva quedó registrada.',
      traducirErrorConfirmacion,
    )
  }

  async function salirDeEspera() {
    const actual = espera.value
    if (!actual) return false
    return ejecutar(() => servicio.salirDeEspera(actual.id), 'Saliste de la lista de espera.', traducirErrorSalidaDeEspera)
  }

  return {
    clase,
    reserva,
    espera,
    posicionEnEspera,
    inscriptos,
    listaEspera,
    ahora,
    cargando,
    error,
    noExiste,
    accionando,
    errorAccion,
    exitoAccion,
    reservaCancelada,
    pagoPenalidad,
    descargandoComprobante,
    errorDescarga,
    esSocio,
    esPersonal,
    reservar,
    cancelarReserva,
    descargarComprobantePenalidad,
    anotarseEnEspera,
    confirmarCupo,
    salirDeEspera,
  }
}
