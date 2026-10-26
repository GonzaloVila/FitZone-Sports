import type { PenalidadCobrada } from '@/compartido/composables/usePenalidadCobrada'
import { formatearMonto } from './presentacion'
import { HORAS_SIN_PENALIDAD, PORCENTAJE_PENALIDAD, momentoDeClase } from './reglas'
import type { Clase } from './services/servicioClases'

// Antes de cancelar con menos de 2 hs de anticipación: la penalidad se cobra al instante, al confirmar.
export const TEXTO_ADVERTENCIA_PENALIDAD = `Cancelás con menos de ${HORAS_SIN_PENALIDAD} horas de anticipación: se cobrará al instante una penalidad del ${PORCENTAJE_PENALIDAD}% del valor de la clase.`

// La clase que se está mirando en el detalle (null en la agenda, que no tiene una clase puntual).
export interface ClaseVista {
  clase: Pick<Clase, 'id' | 'horarioInicio'>
  ahora: number
}

// Qué dice el aviso de la última penalidad cobrada (el cobro ya ocurrió: los textos van en pasado), o null si no se muestra.
// - En el detalle de una clase que ya comenzó no se muestra.
// - En el detalle de la misma clase cuya reserva se canceló: "Reserva cancelada. Se cobró una penalidad de $X."
// - En la agenda y en el detalle de otra clase: un texto informativo con la clase cancelada, sin repetir "Reserva cancelada".
export function textoAvisoPenalidad(penalidad: PenalidadCobrada, vista: ClaseVista | null): string | null {
  const monto = formatearMonto(penalidad.monto)
  if (vista && momentoDeClase(vista.clase, vista.ahora) === 'comenzada') return null
  if (vista && penalidad.clase?.id === vista.clase.id) return `Reserva cancelada. Se cobró una penalidad de ${monto}.`
  if (!penalidad.clase) return `Tu última cancelación tuvo una penalidad de ${monto}.`
  return `Tu última cancelación («${penalidad.clase.tipo}», ${penalidad.clase.horario}) tuvo una penalidad de ${monto}.`
}
