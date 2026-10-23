import { ref, type Ref } from 'vue'
import { esErrorApi, mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { Ingreso } from '../services/servicioAcceso'
import { TIPOS_ERROR_ACCESO } from '../tipos'

export type TipoResultadoIngreso =
  | 'exito'
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

export function useRegistroIngreso(sedeId: Ref<number | null | undefined>) {
  const servicioAcceso = useServicios().acceso

  const socioIdInput = ref('')
  const codigoTotpInput = ref('')
  const procesando = ref(false)
  const resultado = ref<ResultadoIngresoInfo | null>(null)

  function limpiarFormulario() {
    codigoTotpInput.value = ''
  }

  function reiniciarResultado() {
    resultado.value = null
  }

  async function registrar(opciones?: { alExito?: (ingreso: Ingreso) => void }) {
    const idSede = sedeId.value
    if (!idSede) {
      resultado.value = {
        tipo: 'error_general',
        mensaje: 'Debe seleccionar una sede antes de registrar el ingreso.',
      }
      return
    }

    const socio = Number(socioIdInput.value)
    if (!socio || isNaN(socio)) {
      resultado.value = {
        tipo: 'error_validacion',
        mensaje: 'Debe indicar el número de socio (ID).',
      }
      return
    }

    // Código TOTP: de 6 dígitos si se provee, o cadena vacía si no
    const codigo = codigoTotpInput.value.trim()

    // Regla de seguridad: limpiar el código del formulario de inmediato
    limpiarFormulario()

    procesando.value = true
    resultado.value = null

    try {
      const ingreso = await servicioAcceso.registrarIngreso({
        sedeId: idSede,
        socioId: socio,
        codigoTotp: codigo,
      })

      resultado.value = {
        tipo: 'exito',
        mensaje: `Ingreso permitido para ${ingreso.nombre} (DNI ${ingreso.dni}).`,
        ingreso,
      }

      opciones?.alExito?.(ingreso)
    } catch (e) {
      if (esErrorApi(e)) {
        const type = e.problema?.type
        if (type === TIPOS_ERROR_ACCESO.MEMBRESIA_INACTIVA || e.status === 403) {
          resultado.value = {
            tipo: 'membresia_inactiva',
            mensaje: 'Acceso rechazado: Membresía no vigente o suspendida.',
            detalle: e.problema?.detail ?? 'El socio no posee una membresía activa para ingresar.',
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
            mensaje: 'Acceso denegado: Aforo completo.',
            detalle: e.problema?.detail ?? 'La sede alcanzó su capacidad máxima.',
          }
        } else if (e.status === 422) {
          resultado.value = {
            tipo: 'error_validacion',
            mensaje: 'Datos de ingreso inválidos.',
            detalle: e.problema?.detail ?? e.message,
          }
        } else {
          resultado.value = {
            tipo: 'error_general',
            mensaje: e.problema?.title ?? 'Error al registrar ingreso.',
            detalle: e.problema?.detail ?? e.message,
          }
        }
      } else {
        resultado.value = {
          tipo: 'error_general',
          mensaje: mensajeDeError(e, 'No se pudo conectar con el servidor.'),
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
    registrar,
    reiniciarResultado,
    limpiarFormulario,
  }
}
