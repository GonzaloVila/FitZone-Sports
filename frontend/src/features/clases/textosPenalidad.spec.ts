import { describe, expect, it } from 'vitest'
import type { PenalidadCobrada } from '@/compartido/composables/usePenalidadCobrada'
import { formatearMonto } from './presentacion'
import { HORAS_SIN_PENALIDAD, PORCENTAJE_PENALIDAD } from './reglas'
import { TEXTO_ADVERTENCIA_PENALIDAD, textoAvisoPenalidad } from './textosPenalidad'

const INICIO = new Date('2026-10-24T18:00:00-03:00').getTime()
const ANTES = INICIO - 60 * 60 * 1000
const DESPUES = INICIO + 60 * 1000
const MONTO = formatearMonto(5000)

const CANCELADA: PenalidadCobrada = {
  pagoId: 99,
  monto: 5000,
  clase: { id: 7, tipo: 'Spinning', horario: 'viernes, 24/10, 18:00 a 19:00 hs' },
}
const claseVista = (id: number, ahora: number) => ({
  clase: { id, horarioInicio: '2026-10-24T18:00:00-03:00' },
  ahora,
})

describe('TEXTO_ADVERTENCIA_PENALIDAD', () => {
  it('sale de las constantes de la regla, con el porcentaje pegado al símbolo y en futuro (todavía no se cobró)', () => {
    expect(TEXTO_ADVERTENCIA_PENALIDAD).toBe(
      `Cancelás con menos de ${HORAS_SIN_PENALIDAD} horas de anticipación: se cobrará al instante una penalidad del ${PORCENTAJE_PENALIDAD}% del valor de la clase.`,
    )
    expect(TEXTO_ADVERTENCIA_PENALIDAD).toContain('2 horas')
    expect(TEXTO_ADVERTENCIA_PENALIDAD).toContain('50%')
  })
})

describe('textoAvisoPenalidad', () => {
  it('en el detalle de la misma clase cancelada dice que se canceló y se cobró', () => {
    expect(textoAvisoPenalidad(CANCELADA, claseVista(7, ANTES))).toBe(`Reserva cancelada. Se cobró una penalidad de ${MONTO}.`)
  })

  it('no se muestra en el detalle de otra clase', () => {
    expect(textoAvisoPenalidad(CANCELADA, claseVista(8, ANTES))).toBeNull()
  })

  it('en la agenda (sin clase puntual) es un texto informativo con la clase cancelada', () => {
    const texto = textoAvisoPenalidad(CANCELADA, null)

    expect(texto).toBe(
      `Tu última cancelación («Spinning», viernes, 24/10, 18:00 a 19:00 hs) tuvo una penalidad de ${MONTO}.`,
    )
    expect(texto).not.toContain('Reserva cancelada')
  })

  it('sin la clase cancelada informa el importe solo en la agenda, sin inventar datos', () => {
    const sinClase: PenalidadCobrada = { pagoId: 99, monto: 5000, clase: null }

    expect(textoAvisoPenalidad(sinClase, null)).toBe(`Tu última cancelación tuvo una penalidad de ${MONTO}.`)
    expect(textoAvisoPenalidad(sinClase, claseVista(7, ANTES))).toBeNull()
  })

  it('no se muestra en el detalle de una clase que ya comenzó, sea la cancelada u otra', () => {
    expect(textoAvisoPenalidad(CANCELADA, claseVista(7, DESPUES))).toBeNull()
    expect(textoAvisoPenalidad(CANCELADA, claseVista(7, INICIO))).toBeNull()
    expect(textoAvisoPenalidad(CANCELADA, claseVista(8, DESPUES))).toBeNull()
  })

  it('en la agenda se muestra siempre', () => {
    expect(textoAvisoPenalidad(CANCELADA, null)).not.toBeNull()
  })
})
