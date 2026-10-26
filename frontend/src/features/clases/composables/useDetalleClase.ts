import { computed, onScopeDispose, ref } from 'vue'
import { esErrorApi, mensajeDeError } from '@/compartido/http/errores'
import { useActualizacionPeriodica } from '@/compartido/composables/useActualizacionPeriodica'
import { useServicios } from '@/compartido/servicios'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { esperasVigentes, esperaVigente, inscriptosVigentes, reservaVigente } from '../reglas'
import {
  traducirErrorCancelacion,
  traducirErrorConfirmacion,
  traducirErrorEspera,
  traducirErrorReserva,
  traducirErrorSalidaDeEspera,
} from '../errores'
import type { Clase, EsperaClase, ReservaClase } from '../services/servicioClases'
import { useRegistroPenalidad } from './useAvisoPenalidad'

// Actualización cada pocos segundos mientras la pantalla está abierta (el servidor notifica la espera, el front no).
const INTERVALO_ACTUALIZACION_MS = 5000
const POR_PAGINA_OCUPACION = 100
// Reservas y esperas de un mismo socio en una misma clase: pocas, aunque cada recorrido (reservar, cancelar) agrega una.
const POR_PAGINA_PROPIAS = 100

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

  const registrarPenalidad = useRegistroPenalidad()

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
        // El listado puede traer también las anteriores (canceladas): se pide una página grande y se elige la vigente.
        const [reservas, esperas] = await Promise.all([
          servicio.listarReservas({ claseId: id, socioId: socioId.value }, 1, POR_PAGINA_PROPIAS, signal),
          servicio.listarEsperas({ claseId: id, socioId: socioId.value }, 1, POR_PAGINA_PROPIAS, signal),
        ])
        reservaActual = reservaVigente(reservas.items)
        esperaActual = esperaVigente(esperas.items)
        if (esperaActual) {
          // El lugar se cuenta entre las esperas vivas: una cancelada que sigue en el listado no ocupa un lugar.
          const cola = esperasVigentes((await servicio.listarEsperaDeClase(id, 1, POR_PAGINA_OCUPACION, signal)).items)
          const lugar = cola.findIndex((item) => item.id === esperaActual?.id)
          posicion = lugar >= 0 ? lugar + 1 : null
        }
      } else if (esPersonal.value) {
        const [ocupacion, cola] = await Promise.all([
          servicio.listarInscriptos(id, 1, POR_PAGINA_OCUPACION, signal),
          servicio.listarEsperaDeClase(id, 1, POR_PAGINA_OCUPACION, signal),
        ])
        // Los dos listados traen también las canceladas aunque el contrato diga que no.
        inscriptosActuales = inscriptosVigentes(ocupacion.items)
        colaActual = esperasVigentes(cola.items)
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

    // Con penalidad, el aviso persistente (monto y comprobante) reemplaza al mensaje simple.
    if ((await registrarPenalidad(actual.id, clase.value)) !== null) exitoAccion.value = null
    return true
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
    esSocio,
    esPersonal,
    reservar,
    cancelarReserva,
    anotarseEnEspera,
    confirmarCupo,
    salirDeEspera,
  }
}
