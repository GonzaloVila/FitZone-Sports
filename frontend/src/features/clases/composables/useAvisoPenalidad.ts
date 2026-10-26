import { usePenalidadCobrada } from '@/compartido/composables/usePenalidadCobrada'
import { useServicios } from '@/compartido/servicios'
import { useDescargaPdf } from '@/features/pagos/composables/useDescargaPdf'
import { formatearHorario } from '../presentacion'
import type { Clase } from '../services/servicioClases'

// Después de cancelar una reserva busca el pago de la penalidad (si hubo) y lo deja como la última penalidad cobrada,
// junto con la clase cancelada. Devuelve el monto cobrado, o null si no hubo cobro o no se pudo consultar (la cancelación
// ya está hecha).
export function useRegistroPenalidad() {
  const servicios = useServicios()
  const { registrar } = usePenalidadCobrada()

  return async function registrarPenalidadDeReserva(
    reservaId: number,
    clase: Pick<Clase, 'id' | 'tipo' | 'horarioInicio' | 'horarioFin'> | null,
  ): Promise<number | null> {
    try {
      const pagos = await servicios.pagos.listar({ reservaClaseId: reservaId }, 1, 1)
      const pago = pagos.items[0] ?? null
      if (!pago) return null
      registrar(pago, clase ? { id: clase.id, tipo: clase.tipo, horario: formatearHorario(clase) } : null)
      return pago.monto
    } catch {
      return null
    }
  }
}

// El aviso de la última penalidad cobrada: lo que muestra, cómo se cierra y la descarga de su comprobante.
export function useAvisoPenalidad() {
  const servicios = useServicios()
  const { penalidad, cerrar } = usePenalidadCobrada()
  const { descargando, error, descargar } = useDescargaPdf()

  function descargarComprobante(): Promise<boolean> {
    const actual = penalidad.value
    if (!actual) return Promise.resolve(false)
    return descargar(`comprobante-penalidad-${actual.pagoId}.pdf`, () =>
      servicios.pagos.descargarComprobante(actual.pagoId),
    )
  }

  return { penalidad, cerrar, descargando, error, descargarComprobante }
}
