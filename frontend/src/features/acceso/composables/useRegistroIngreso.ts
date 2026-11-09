import { ref, watch, type Ref } from 'vue'
import { esErrorApi, mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { Ingreso } from '../services/servicioAcceso'
import type { Bloqueo } from './useListaBloqueadosOffline'
import { TIPOS_ERROR_ACCESO } from '../tipos'
import { validarIngreso, type ErroresIngreso } from '../validacionIngreso'

export type TipoResultadoIngreso =
  | 'exito'
  | 'offline'
  | 'membresia_inactiva'
  | 'acceso_duplicado'
  | 'aforo_lleno'
  | 'error_validacion'
  | 'error_general'

export interface ResultadoIngresoInfo {
  tipo: TipoResultadoIngreso
  mensaje: string
  detalle?: string
  ingreso?: Ingreso
}

const MOTIVOS_BLOQUEO: Record<Bloqueo['motivo'], string> = { VENCIDA: 'vencida', SUSPENDIDA: 'suspendida' }

function fechaCorta(iso: string): string {
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime()) ? iso : fecha.toLocaleDateString('es-AR')
}

export interface OpcionesRegistro {
  alExito?: (ingreso: Ingreso) => void
  alEncolarOffline?: (datos: { socioId: number; codigoTotp: string }) => void
  // Lista local de inhabilitados (RNF-01): sin conexión, un socio que figure ahí se rechaza en el momento y no se encola.
  bloqueoOffline?: (socioId: number) => Bloqueo | null
  enLinea?: boolean
}

export function useRegistroIngreso(sedeId: Ref<number | null | undefined>) {
  const servicioAcceso = useServicios().acceso

  const socioIdInput = ref('')
  const codigoTotpInput = ref('')
  const procesando = ref(false)
  const resultado = ref<ResultadoIngresoInfo | null>(null)
  // Errores de la validación de ayuda, por campo: se muestran junto al campo (sede, socio, código).
  const errores = ref<ErroresIngreso>({})

  function limpiarFormulario() {
    codigoTotpInput.value = ''
  }

  function reiniciarResultado() {
    resultado.value = null
    errores.value = {}
  }

  // Escribir o elegir en un campo saca su error.
  watch(sedeId, () => delete errores.value.sedeId)
  watch(socioIdInput, () => delete errores.value.socioId)
  watch(codigoTotpInput, () => delete errores.value.codigoTotp)

  // Sin conexión: rechaza al socio si figura en la lista local de inhabilitados; si no, lo deja en la cola del puesto.
  function resolverSinConexion(
    encolar: NonNullable<OpcionesRegistro['alEncolarOffline']>,
    bloqueoOffline: OpcionesRegistro['bloqueoOffline'],
    datos: { socioId: number; codigoTotp: string },
    aviso: Pick<ResultadoIngresoInfo, 'mensaje' | 'detalle'>,
  ) {
    const bloqueo = bloqueoOffline?.(datos.socioId)
    if (bloqueo) {
      resultado.value = {
        tipo: 'membresia_inactiva',
        mensaje: 'La membresía no está vigente o está suspendida.',
        detalle: `Según la lista local del puesto, la membresía está ${MOTIVOS_BLOQUEO[bloqueo.motivo]} desde el ${fechaCorta(bloqueo.desde)}. El ingreso no se guardó.`,
      }
      return
    }
    encolar(datos)
    resultado.value = { tipo: 'offline', ...aviso }
  }

  async function registrar(opciones?: OpcionesRegistro) {
    errores.value = validarIngreso({ sedeId: sedeId.value, socioId: socioIdInput.value, codigoTotp: codigoTotpInput.value })
    if (Object.keys(errores.value).length > 0) {
      resultado.value = null
      return
    }
    const idSede = sedeId.value as number
    const socio = Number(String(socioIdInput.value).trim())

    // Código TOTP: los 6 dígitos del carnet
    const codigo = String(codigoTotpInput.value).trim()

    // Regla de seguridad: limpiar el código del formulario de inmediato
    limpiarFormulario()

    procesando.value = true
    resultado.value = null

    // Si explícitamente se detectó offline o navigator.onLine es false, encolar sin llamar a la API
    const estaOffline = opciones?.enLinea === false || (typeof navigator !== 'undefined' && !navigator.onLine)
    if (estaOffline && opciones?.alEncolarOffline) {
      resolverSinConexion(opciones.alEncolarOffline, opciones.bloqueoOffline, { socioId: socio, codigoTotp: codigo }, {
        mensaje: 'Registrado sin conexión, se sincronizará al reconectar.',
        detalle: `Socio #${socio} guardado en la cola local del puesto.`,
      })
      procesando.value = false
      return
    }

    try {
      const ingreso = await servicioAcceso.registrarIngreso({
        sedeId: idSede,
        socioId: socio,
        codigoTotp: codigo,
      })

      resultado.value = {
        tipo: 'exito',
        mensaje: `Registramos el ingreso de ${ingreso.nombre}.`,
        ingreso,
      }

      opciones?.alExito?.(ingreso)
    } catch (e) {
      if (esErrorApi(e)) {
        const type = e.problema?.type
        if (type === TIPOS_ERROR_ACCESO.MEMBRESIA_INACTIVA || e.status === 403) {
          resultado.value = {
            tipo: 'membresia_inactiva',
            mensaje: 'La membresía no está vigente o está suspendida.',
            detalle: e.problema?.detail,
          }
        } else if (type === TIPOS_ERROR_ACCESO.ACCESO_DUPLICADO) {
          resultado.value = {
            tipo: 'acceso_duplicado',
            mensaje: 'El socio ya está dentro de una sede. Registrá primero su egreso.',
            detalle: e.problema?.detail,
          }
        } else if (type === TIPOS_ERROR_ACCESO.AFORO_LLENO) {
          resultado.value = {
            tipo: 'aforo_lleno',
            mensaje: 'La sede alcanzó su capacidad máxima.',
            detalle: e.problema?.detail ?? 'Podrá ingresar cuando alguien registre su egreso.',
          }
        } else if (e.status === 422) {
          resultado.value = {
            tipo: 'error_validacion',
            mensaje: 'Revisá los datos del ingreso.',
            detalle: e.problema?.detail ?? e.message,
          }
        } else {
          resultado.value = {
            tipo: 'error_general',
            mensaje: e.problema?.title ?? 'No se pudo registrar el ingreso.',
            detalle: e.problema?.detail ?? e.message,
          }
        }
      } else {
        // Fallo de red (no es ErrorApi): si hay callback para encolar offline, lo guardamos en la cola
        if (opciones?.alEncolarOffline) {
          resolverSinConexion(opciones.alEncolarOffline, opciones.bloqueoOffline, { socioId: socio, codigoTotp: codigo }, {
            mensaje: 'Sin conexión con el servidor. Registrado en cola offline.',
            detalle: 'Se sincronizará automáticamente cuando se restablezca la red.',
          })
        } else {
          resultado.value = {
            tipo: 'error_general',
            mensaje: mensajeDeError(e, 'No se pudo conectar con el servidor.'),
          }
        }
      }
    } finally {
      procesando.value = false
    }
  }

  return {
    socioIdInput,
    codigoTotpInput,
    procesando,
    resultado,
    errores,
    registrar,
    reiniciarResultado,
    limpiarFormulario,
  }
}
