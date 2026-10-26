import { describe, expect, it } from 'vitest'

import { ErrorApi, type Problema } from '@/compartido/http/errores'
import { cambiosDeDatos, datosIniciales, erroresDeDatos, hayCambios, repartirErroresEdicion } from './edicionDatos'

const original = { nombre: 'Camila Domínguez', telefono: '1155550000' }

function error422(errors: string[]) {
  return new ErrorApi(422, 'Datos inválidos', { title: 'Unprocessable', status: 422, detail: 'Datos inválidos', errors } as Problema)
}

describe('datosIniciales', () => {
  it('toma el nombre del socio y el teléfono del usuario', () => {
    expect(datosIniciales('Camila Domínguez', { telefono: '1155550000' })).toEqual(original)
  })

  it('sin teléfono (null, ausente) o sin usuario, el teléfono arranca vacío', () => {
    expect(datosIniciales('Camila', { telefono: null })).toEqual({ nombre: 'Camila', telefono: '' })
    expect(datosIniciales('Camila', {})).toEqual({ nombre: 'Camila', telefono: '' })
    expect(datosIniciales('Camila', null)).toEqual({ nombre: 'Camila', telefono: '' })
  })
})

describe('cambiosDeDatos', () => {
  it('sin cambios no manda nada', () => {
    expect(cambiosDeDatos(original, { ...original })).toEqual({})
    expect(hayCambios(cambiosDeDatos(original, { ...original }))).toBe(false)
  })

  it('manda solo el campo que cambió', () => {
    expect(cambiosDeDatos(original, { ...original, nombre: 'Camila D. Pérez' })).toEqual({ nombre: 'Camila D. Pérez' })
    expect(cambiosDeDatos(original, { ...original, telefono: '1166667777' })).toEqual({ telefono: '1166667777' })
  })

  it('manda los dos si cambiaron los dos', () => {
    expect(cambiosDeDatos(original, { nombre: 'Cami', telefono: '1100000000' })).toEqual({ nombre: 'Cami', telefono: '1100000000' })
  })

  it('recorta los espacios de los bordes, y un cambio que solo agrega espacios no cuenta', () => {
    expect(cambiosDeDatos(original, { nombre: '  Camila Domínguez  ', telefono: ' 1155550000 ' })).toEqual({})
    expect(cambiosDeDatos(original, { ...original, nombre: '  Cami  ' })).toEqual({ nombre: 'Cami' })
  })

  it('un teléfono vaciado (o solo espacios) se manda como null', () => {
    expect(cambiosDeDatos(original, { ...original, telefono: '' })).toEqual({ telefono: null })
    expect(cambiosDeDatos(original, { ...original, telefono: '   ' })).toEqual({ telefono: null })
  })

  it('si no tenía teléfono y sigue vacío, no hay cambio (no se manda null de más)', () => {
    expect(cambiosDeDatos({ nombre: 'Camila', telefono: '' }, { nombre: 'Camila', telefono: '  ' })).toEqual({})
  })

  it('si no tenía teléfono y se carga uno, se manda', () => {
    expect(cambiosDeDatos({ nombre: 'Camila', telefono: '' }, { nombre: 'Camila', telefono: '1155550000' })).toEqual({ telefono: '1155550000' })
  })
})

describe('erroresDeDatos', () => {
  it('el nombre es obligatorio (con solo espacios también falta)', () => {
    expect(erroresDeDatos({ nombre: '', telefono: '' }).nombre).toBeDefined()
    expect(erroresDeDatos({ nombre: '   ', telefono: '' }).nombre).toBeDefined()
    expect(erroresDeDatos(original)).toEqual({})
  })

  it('el teléfono es opcional', () => {
    expect(erroresDeDatos({ nombre: 'Camila', telefono: '' })).toEqual({})
  })
})

describe('repartirErroresEdicion', () => {
  it('un 422 se reparte por campo y no deja error general si todo tiene campo', () => {
    const { campos, general } = repartirErroresEdicion(error422(['nombre must not be blank', 'telefono is too long']), 'Falló')

    expect(campos).toEqual({ nombre: 'nombre must not be blank', telefono: 'telefono is too long' })
    expect(general).toBeNull()
  })

  it('lo que un 422 no asigna a un campo queda como error general', () => {
    const { campos, general } = repartirErroresEdicion(error422(['nombre must not be blank', 'fotoUrl is invalid']), 'Falló')

    expect(campos).toEqual({ nombre: 'nombre must not be blank' })
    expect(general).toBe('fotoUrl is invalid')
  })

  it('un 422 sin detalle, otro error del contrato y un error cualquiera son errores generales', () => {
    expect(repartirErroresEdicion(new ErrorApi(422, 'Datos inválidos'), 'Falló')).toEqual({ campos: {}, general: 'Datos inválidos' })
    expect(repartirErroresEdicion(new ErrorApi(404, 'No existe el usuario'), 'Falló')).toEqual({ campos: {}, general: 'No existe el usuario' })
    expect(repartirErroresEdicion(new Error('caída'), 'No se pudieron guardar los datos.')).toEqual({
      campos: {},
      general: 'No se pudieron guardar los datos.',
    })
  })
})
