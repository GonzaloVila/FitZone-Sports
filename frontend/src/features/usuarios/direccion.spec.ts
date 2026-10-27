import { describe, expect, it } from 'vitest'
import { leerConsultaPersonal, parametrosDeConsultaPersonal, sinParametrosDePersonal } from './direccion'

describe('leerConsultaPersonal', () => {
  it('sin parámetros: todas las sedes, sin filtro y página 1', () => {
    expect(leerConsultaPersonal({})).toEqual({ sede: '', nombre: '', pagina: 1 })
  })

  it('lee la sede, el nombre recortado y la página', () => {
    expect(leerConsultaPersonal({ sede: '3', nombre: ' Ana ', pagina: '3' })).toEqual({ sede: '3', nombre: 'Ana', pagina: 3 })
  })

  it('una sede inválida (o "todas") vale como todas las sedes', () => {
    for (const sede of ['abc', '0', '-1', '1.5', '', ' 2', 'todas']) {
      expect(leerConsultaPersonal({ sede }).sede).toBe('')
    }
  })

  it('una página inválida vuelve a la 1 y un parámetro que no es texto se ignora', () => {
    for (const pagina of ['0', '-2', 'x', '1.5', '']) {
      expect(leerConsultaPersonal({ pagina }).pagina).toBe(1)
    }
    expect(leerConsultaPersonal({ sede: 4, nombre: null, pagina: 4 })).toEqual({ sede: '', nombre: '', pagina: 1 })
    expect(leerConsultaPersonal({ sede: ['5', '6'], nombre: ['Ana', 'Luz'], pagina: ['2'] })).toEqual({
      sede: '5',
      nombre: 'Ana',
      pagina: 2,
    })
  })
})

describe('parametrosDeConsultaPersonal', () => {
  it('escribe solo lo que se aparta del valor por defecto', () => {
    expect(parametrosDeConsultaPersonal({ sede: '', nombre: '', pagina: 1 })).toEqual({})
    expect(parametrosDeConsultaPersonal({ sede: '3', nombre: ' Ana ', pagina: 2 })).toEqual({
      sede: '3',
      nombre: 'Ana',
      pagina: '2',
    })
    expect(parametrosDeConsultaPersonal({ sede: '', nombre: '', pagina: 4 })).toEqual({ pagina: '4' })
    expect(parametrosDeConsultaPersonal({ sede: '7', nombre: '', pagina: 1 })).toEqual({ sede: '7' })
  })

  it('ida y vuelta: lo que se escribe se lee igual', () => {
    for (const consulta of [
      { sede: '2', nombre: 'Ana', pagina: 3 },
      { sede: '', nombre: '', pagina: 1 },
      { sede: '9', nombre: '', pagina: 1 },
    ]) {
      expect(leerConsultaPersonal(parametrosDeConsultaPersonal(consulta))).toEqual(consulta)
    }
  })
})

describe('sinParametrosDePersonal', () => {
  it('quita sede, nombre y página y conserva los demás', () => {
    expect(sinParametrosDePersonal({ otra: '1', sede: '2', nombre: 'Ana', pagina: '2' })).toEqual({ otra: '1' })
  })
})
