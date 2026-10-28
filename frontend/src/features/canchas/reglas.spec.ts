import { describe, expect, it } from 'vitest'
import { puedeReservar, veQuienReservo } from './reglas'

describe('veQuienReservo', () => {
  it('lo ven RECEPCION y GERENTE', () => {
    expect(veQuienReservo('RECEPCION')).toBe(true)
    expect(veQuienReservo('GERENTE')).toBe(true)
  })

  it('SOCIO, EXTERNO y sin rol no lo ven', () => {
    expect(veQuienReservo('SOCIO')).toBe(false)
    expect(veQuienReservo('EXTERNO')).toBe(false)
    expect(veQuienReservo(null)).toBe(false)
    expect(veQuienReservo(undefined)).toBe(false)
  })
})

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
