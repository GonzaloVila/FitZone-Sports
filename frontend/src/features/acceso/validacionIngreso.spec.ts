import { describe, expect, it } from 'vitest'
import { validarIngreso } from './validacionIngreso'

const valido = { sedeId: 3, socioId: '12', codigoTotp: '123456' }

describe('validarIngreso', () => {
  it('con sede, socio y código no hay errores', () => {
    expect(validarIngreso(valido)).toEqual({})
  })

  it('sin sede elegida pide "Elegí la sede de acceso."', () => {
    expect(validarIngreso({ ...valido, sedeId: null })).toEqual({ sedeId: 'Elegí la sede de acceso.' })
    expect(validarIngreso({ ...valido, sedeId: undefined })).toEqual({ sedeId: 'Elegí la sede de acceso.' })
  })

  it('acepta el socio como número (como lo entrega un campo numérico) y como texto', () => {
    expect(validarIngreso({ ...valido, socioId: 12 })).toEqual({})
    expect(validarIngreso({ ...valido, socioId: ' 12 ' })).toEqual({})
  })

  it('un socio vacío, nulo, cero, negativo, decimal o que no es un número es inválido', () => {
    for (const socioId of ['', '  ', null, undefined, 0, -3, '1.5', 'abc']) {
      expect(validarIngreso({ ...valido, socioId }).socioId, String(socioId)).toBe('Ingresá el número de socio.')
    }
  })

  it('un código vacío o nulo es inválido', () => {
    for (const codigoTotp of ['', '   ', null, undefined]) {
      expect(validarIngreso({ ...valido, codigoTotp }).codigoTotp, String(codigoTotp)).toBe('Ingresá el código del carnet.')
    }
  })

  it('junta todos los errores a la vez', () => {
    expect(Object.keys(validarIngreso({ sedeId: null, socioId: '', codigoTotp: '' }))).toEqual(['sedeId', 'socioId', 'codigoTotp'])
  })
})
