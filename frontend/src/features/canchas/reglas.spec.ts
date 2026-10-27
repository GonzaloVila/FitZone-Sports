import { describe, expect, it } from 'vitest'
import { puedeReservar } from './reglas'

describe('puedeReservar', () => {
  it('reservan el SOCIO y el EXTERNO', () => {
    expect(puedeReservar('SOCIO')).toBe(true)
    expect(puedeReservar('EXTERNO')).toBe(true)
  })

  it('RECEPCION y GERENTE solo consultan', () => {
    expect(puedeReservar('RECEPCION')).toBe(false)
    expect(puedeReservar('GERENTE')).toBe(false)
  })

  it('sin rol no se reserva', () => {
    expect(puedeReservar(null)).toBe(false)
    expect(puedeReservar(undefined)).toBe(false)
  })
})
