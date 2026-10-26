import { describe, expect, it } from 'vitest'

import { marcaDeEnlace } from './navegacion'

const aforo = { ruta: '/acceso/aforo', nombre: 'acceso-aforo' }
const socios = { ruta: '/socios', nombre: 'socios' }

describe('marcaDeEnlace', () => {
  it('en la pantalla del ítem queda marcado como la página actual', () => {
    expect(marcaDeEnlace(aforo, { path: '/acceso/aforo' })).toBe('page')
  })

  it('en una ruta que cuelga de su path queda marcado como sección actual (como siempre)', () => {
    expect(marcaDeEnlace(socios, { path: '/socios/12' })).toBe('true')
  })

  it('una ruta que declara pertenecer al ítem lo marca como sección actual, aunque su path sea otro', () => {
    for (const path of ['/acceso/ingreso', '/acceso/historial', '/sedes/nueva']) {
      expect(marcaDeEnlace(aforo, { path, activaEn: 'acceso-aforo' })).toBe('true')
    }
  })

  it('declarar pertenecer a un ítem no marca a los demás', () => {
    expect(marcaDeEnlace(socios, { path: '/sedes/nueva', activaEn: 'acceso-aforo' })).toBeUndefined()
  })

  it('sin relación no se marca: otro path, y un path que solo empieza igual pero no es de adentro', () => {
    expect(marcaDeEnlace(aforo, { path: '/socios' })).toBeUndefined()
    expect(marcaDeEnlace(socios, { path: '/sociosnuevos' })).toBeUndefined()
  })

  it('sin nombre de ruta en el ítem, solo cuenta el path', () => {
    expect(marcaDeEnlace({ ruta: '/acceso/aforo' }, { path: '/sedes/nueva', activaEn: 'acceso-aforo' })).toBeUndefined()
  })
})
