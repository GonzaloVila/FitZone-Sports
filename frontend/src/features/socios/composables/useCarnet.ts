import { computed, onScopeDispose, ref } from 'vue'
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

// El secreto viaja dentro de la URI otpauth (parámetro `secret`); se extrae para la carga manual.
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
  let desmontado = false

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
  }

  function limpiarErrorQr() {
    errorQr.value = null
  }

  onScopeDispose(() => {
    desmontado = true
    descartarQr()
  })

  return { ...detalle, sinSocio, qrUri, secreto, mensajeQr, generando, errorQr, generarQr, descartarQr, limpiarErrorQr }
}
