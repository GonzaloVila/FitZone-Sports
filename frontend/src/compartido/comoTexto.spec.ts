import { describe, expect, it } from 'vitest'
import { comoTexto } from './comoTexto'

describe('comoTexto', () => {
  it('deja el texto sin espacios en los bordes', () => {
    expect(comoTexto('  hola ')).toBe('hola')
    expect(comoTexto('')).toBe('')
  })

  it('pasa un número a texto (como lo entrega un campo numérico)', () => {
    expect(comoTexto(10000)).toBe('10000')
    expect(comoTexto(0)).toBe('0')
    expect(comoTexto(7250.5)).toBe('7250.5')
  })

  it('un valor nulo o indefinido es texto vacío', () => {
    expect(comoTexto(null)).toBe('')
    expect(comoTexto(undefined)).toBe('')
  })
})
