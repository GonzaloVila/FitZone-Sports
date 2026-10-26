import { describe, expect, it } from 'vitest'

import { ErrorApi, type Problema } from '@/compartido/http/errores'
import { repartirErroresSede } from './erroresSede'

function error422(errors: string[]) {
  return new ErrorApi(422, 'Datos inválidos', { title: 'Unprocessable', status: 422, detail: 'Datos inválidos', errors } as Problema)
}

describe('repartirErroresSede', () => {
  it('un 422 se reparte por campo y no deja error general si todo tiene campo', () => {
    const { campos, general } = repartirErroresSede(error422(['nombre must not be blank', 'aforoMaximo must be >= 1']))

    expect(campos).toEqual({ nombre: 'nombre must not be blank', aforoMaximo: 'aforoMaximo must be >= 1' })
    expect(general).toBeNull()
  })

  it('lo que un 422 no asigna a un campo queda como error general', () => {
    const { campos, general } = repartirErroresSede(error422(['direccion is too long', 'foto is invalid']))

    expect(campos).toEqual({ direccion: 'direccion is too long' })
    expect(general).toBe('foto is invalid')
  })

  it('un 422 sin detalle es un error general con su mensaje', () => {
    expect(repartirErroresSede(new ErrorApi(422, 'Datos de la sede inválidos'))).toEqual({
      campos: {},
      general: 'Datos de la sede inválidos',
    })
  })

  it('un 409 que nombra el nombre va junto al campo; otro 409 es un error general', () => {
    expect(repartirErroresSede(new ErrorApi(409, 'Ya existe una sede con ese nombre'))).toEqual({
      campos: { nombre: 'Ya existe una sede con ese nombre' },
      general: null,
    })
    expect(repartirErroresSede(new ErrorApi(409, 'Conflicto con otra sede'))).toEqual({ campos: {}, general: 'Conflicto con otra sede' })
  })

  it('otro error del contrato muestra su mensaje y uno que no es del contrato, el texto por defecto', () => {
    expect(repartirErroresSede(new ErrorApi(500, 'Falló el servidor'))).toEqual({ campos: {}, general: 'Falló el servidor' })
    expect(repartirErroresSede(new Error('caída'))).toEqual({ campos: {}, general: 'No se pudo crear la sede.' })
  })
})
