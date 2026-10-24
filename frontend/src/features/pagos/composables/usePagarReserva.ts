import { computed, ref } from 'vue'
import { esErrorApi, mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { ReservaCancha } from '@/features/canchas/services/servicioCanchas'
import { mensajePago } from '../errores'
import { tokenDeMedio } from '../presentacion'
import type { Pago, PagoIn } from '../services/servicioPagos'

export function usePagarReserva(reservaId: number) {
  const servicios = useServicios()

  const reserva = ref<ReservaCancha | null>(null)
  const cargando = ref(true)
  const errorCarga = ref<string | null>(null)

  const medio = ref('aprobada')
  const enviando = ref(false)
  const error = ref<string | null>(null)
  const pago = ref<Pago | null>(null)

  let clave: string | null = null

  const aprobado = computed(() => pago.value?.estado === 'APROBADO')

  const claveActual = () => (clave ??= crypto.randomUUID())

  async function cargar() {
    cargando.value = true
    errorCarga.value = null
    try {
      reserva.value = await servicios.canchas.obtenerReserva(reservaId)
    } catch (e) {
      reserva.value = null
      errorCarga.value = mensajeDeError(e, 'No se pudo cargar la reserva.')
    } finally {
      cargando.value = false
    }
  }

  async function buscarPagoExistente(id: number): Promise<Pago | null> {
    try {
      const lista = await servicios.pagos.listar({ reservaCanchaId: id }, 1, 1)
      return lista.items[0] ?? null
    } catch {
      return null
    }
  }

  async function pagar(): Promise<Pago | null> {
    if (enviando.value) return null
    const actual = reserva.value
    if (!actual) return null

    enviando.value = true
    error.value = null
    try {
      const cuerpo: PagoIn = {
        concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: actual.id },
        token: tokenDeMedio(medio.value),
        moneda: 'ARS',
      }
      pago.value = await servicios.pagos.procesar(cuerpo, claveActual())
      return pago.value
    } catch (e) {
      if (esErrorApi(e) && e.status === 409) {
        const existente = await buscarPagoExistente(actual.id)
        if (existente) {
          pago.value = existente
          return existente
        }
      }
      error.value = mensajePago(e)
      if (esErrorApi(e) && e.status === 402) clave = null
      return null
    } finally {
      enviando.value = false
    }
  }

  void cargar()

  return { reserva, cargando, errorCarga, medio, enviando, error, pago, aprobado, pagar }
}
