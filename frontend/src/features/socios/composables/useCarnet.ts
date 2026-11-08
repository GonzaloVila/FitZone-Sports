import { computed, onScopeDispose, ref } from 'vue'
import * as OTPAuth from 'otpauth'
import { esErrorApiConEstado, mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { useDetalleSocio } from './useDetalleSocio'

function mensajeDeErrorQr(e: unknown): string {
  if (esErrorApiConEstado(e, 401)) return 'Tu sesión venció. Volvé a ingresar para generar el código.'
  if (esErrorApiConEstado(e, 403)) return 'Solo los socios pueden generar el código de acceso.'
  if (esErrorApiConEstado(e, 404)) return 'No se encontró tu registro de socio.'
  return mensajeDeError(e, 'No se pudo generar el código de acceso. Probá de nuevo.')
}

// El secreto viaja dentro de la URI otpauth (parámetro `secret`); se extrae para la carga manual y generación local.
function secretoDeUri(uri: string): string | null {
  try {
    return new URL(uri).searchParams.get('secret')
  } catch {
    return null
  }
}

export function useCarnet() {
  const servicios = useServicios()
  const { socioId } = useUsuarioSesion()

  // Los datos del carnet se cargan igual que el detalle del socio (el socio sale de la sesión).
  const detalle = useDetalleSocio(socioId)
  // Sin socioId en la sesión no hay carnet que mostrar.
  const sinSocio = computed(() => socioId.value === null)

  // ---- QR de acceso ----
  // La URI y el secreto viven solo acá (memoria del componente): no van a un store, a storage ni a la consola.
  const qrUri = ref<string | null>(null)
  const secreto = ref<string | null>(null)
  const mensajeQr = ref<string | null>(null)
  const generando = ref(false)
  const errorQr = ref<string | null>(null)

  // ---- QR Dinámico de Acceso Rápido (payload JSON con TOTP de 30s) ----
  const codigoTotpActual = ref<string | null>(null)
  const segundosRestantes = ref<number>(30)
  let temporizadorTotp: ReturnType<typeof setInterval> | null = null
  let desmontado = false

  function calcularTotp() {
    if (!secreto.value) {
      codigoTotpActual.value = null
      return
    }
    try {
      const totp = new OTPAuth.TOTP({
        secret: secreto.value,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      })
      codigoTotpActual.value = totp.generate()
      const epochActual = Math.floor(Date.now() / 1000)
      segundosRestantes.value = 30 - (epochActual % 30)
    } catch {
      codigoTotpActual.value = null
    }
  }

  function iniciarTemporizadorTotp() {
    detenerTemporizadorTotp()
    calcularTotp()
    temporizadorTotp = setInterval(() => {
      const epochActual = Math.floor(Date.now() / 1000)
      const rest = 30 - (epochActual % 30)
      segundosRestantes.value = rest
      if (rest === 30 || !codigoTotpActual.value) {
        calcularTotp()
      }
    }, 1000)
  }

  function detenerTemporizadorTotp() {
    if (temporizadorTotp) {
      clearInterval(temporizadorTotp)
      temporizadorTotp = null
    }
  }

  // Payload que codifica el QR para el lector de recepción:
  // {"socioId": 12, "codigoTotp": "123456"}
  const payloadQrAcceso = computed(() => {
    if (!socioId.value || !codigoTotpActual.value) return null
    return JSON.stringify({
      socioId: socioId.value,
      codigoTotp: codigoTotpActual.value,
    })
  })

  // Reemplaza el secreto anterior del socio: se llama solo tras una confirmación explícita, nunca al cargar.
  async function generarQr(): Promise<boolean> {
    if (generando.value) return false
    generando.value = true
    errorQr.value = null
    try {
      const registro = await servicios.socios.registrarQr()
      if (desmontado) return false
      qrUri.value = registro.qrUri
      secreto.value = secretoDeUri(registro.qrUri)
      mensajeQr.value = registro.mensaje
      iniciarTemporizadorTotp()
      return true
    } catch (e) {
      if (!desmontado) errorQr.value = mensajeDeErrorQr(e)
      return false
    } finally {
      generando.value = false
    }
  }

  function descartarQr() {
    qrUri.value = null
    secreto.value = null
    mensajeQr.value = null
    codigoTotpActual.value = null
    detenerTemporizadorTotp()
  }

  function limpiarErrorQr() {
    errorQr.value = null
  }

  onScopeDispose(() => {
    desmontado = true
    descartarQr()
  })

  return {
    ...detalle,
    sinSocio,
    qrUri,
    secreto,
    mensajeQr,
    generando,
    errorQr,
    codigoTotpActual,
    segundosRestantes,
    payloadQrAcceso,
    generarQr,
    descartarQr,
    limpiarErrorQr,
  }
}
