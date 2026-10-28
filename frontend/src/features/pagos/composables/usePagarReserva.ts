import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { esErrorApi } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { ReservaCancha } from '@/features/canchas/services/servicioCanchas'
import { MENSAJE_PAGO_NO_PROCESADO, esIdempotenciaRepetida, mensajePago } from '../errores'
import { MEDIOS_PAGO, tokenDeMedio } from '../presentacion'
import type { Pago, PagoIn } from '../services/servicioPagos'

export const MENSAJE_SIN_MEDIO = 'Elegí un medio de pago.'

// El pago de una reserva de cancha que ya está cargada (quien lo usa tiene la reserva en la mano: la fila de "Mis reservas" o
// la que acaba de crear). `reiniciar` deja todo como recién abierto: sin medio elegido, sin resultado y con una clave nueva.
export function usePagarReserva(reserva: MaybeRefOrGetter<ReservaCancha | null>) {
  const servicios = useServicios()

  // '' = sin elegir (el select arranca en "Elegí un medio de pago"); si no, un valor opaco de MEDIOS_PAGO.
  const medio = ref('')
  const errorMedio = ref<string | null>(null)
  const enviando = ref(false)
  const error = ref<string | null>(null)
  const pago = ref<Pago | null>(null)

  // La Idempotency-Key identifica UNA operación de cobro: solo se conserva en el reintento de esa misma operación (corte de
  // red) y siempre va ligada a la reserva para la que se generó. Una reserva distinta nunca hereda la clave de otra.
  let clave: string | null = null
  let claveDeReserva: number | null = null

  const aprobado = computed(() => pago.value?.estado === 'APROBADO')

  function descartarClave() {
    clave = null
    claveDeReserva = null
  }

  function claveActual(reservaId: number): string {
    if (clave === null || claveDeReserva !== reservaId) {
      clave = crypto.randomUUID()
      claveDeReserva = reservaId
    }
    return clave
  }

  watch(medio, () => {
    errorMedio.value = null
  })

  function reiniciar() {
    medio.value = ''
    errorMedio.value = null
    error.value = null
    pago.value = null
    descartarClave()
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
    const actual = toValue(reserva)
    if (!actual) return null

    // Validación de ayuda de uso: sin medio no se manda nada.
    if (!MEDIOS_PAGO.some((opcion) => opcion.valor === medio.value)) {
      errorMedio.value = MENSAJE_SIN_MEDIO
      return null
    }

    enviando.value = true
    error.value = null
    try {
      const cuerpo: PagoIn = {
        concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: actual.id },
        token: tokenDeMedio(medio.value),
        moneda: 'ARS',
      }
      pago.value = await servicios.pagos.procesar(cuerpo, claveActual(actual.id))
      return pago.value
    } catch (e) {
      if (esErrorApi(e) && e.status === 409) {
        const existente = await buscarPagoExistente(actual.id)
        if (existente) {
          pago.value = existente
          return existente
        }
        // La clave ya estaba usada por otro cobro y esta reserva no tiene pago: no está "ya procesada". Se pide reintentar
        // (con una clave nueva).
        if (esIdempotenciaRepetida(e)) {
          error.value = MENSAJE_PAGO_NO_PROCESADO
          descartarClave()
          return null
        }
      }
      error.value = mensajePago(e)
      if (esErrorApi(e) && e.status === 402) descartarClave()
      return null
    } finally {
      enviando.value = false
    }
  }

  return { medio, errorMedio, enviando, error, pago, aprobado, pagar, reiniciar }
}
