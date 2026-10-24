import { describe, expect, it } from 'vitest'

import { etiquetaRol } from './presentacion'

describe('etiquetaRol', () => {
  it('traduce cada rol a su etiqueta', () => {
    expect(etiquetaRol('GERENTE')).toBe('Gerente')
    expect(etiquetaRol('RECEPCION')).toBe('Recepción')
    expect(etiquetaRol('SOCIO')).toBe('Socio')
    expect(etiquetaRol('EXTERNO')).toBe('Externo')
  })

  it('un rol desconocido se muestra como "Usuario"', () => {
    expect(etiquetaRol(null)).toBe('Usuario')
  })
})
