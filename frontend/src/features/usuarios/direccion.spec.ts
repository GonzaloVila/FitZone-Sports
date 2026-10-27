import { describe, expect, it } from 'vitest'
import { leerConsultaPersonal, parametrosDeConsultaPersonal, sinParametrosDePersonal } from './direccion'

describe('leerConsultaPersonal', () => {
  it('sin parámetros: sin filtro y página 1', () => {
    expect(leerConsultaPersonal({})).toEqual({ nombre: '', pagina: 1 })
  })

  it('lee el nombre recortado y la página', () => {
    expect(leerConsultaPersonal({ nombre: ' Ana ', pagina: '3' })).toEqual({ nombre: 'Ana', pagina: 3 })
  })

  it('una página inválida vuelve a la 1 y un parámetro que no es texto se ignora', () => {
    for (const pagina of ['0', '-2', 'x', '1.5', '']) {
      expect(leerConsultaPersonal({ pagina }).pagina).toBe(1)
    }
    expect(leerConsultaPersonal({ nombre: null, pagina: 4 })).toEqual({ nombre: '', pagina: 1 })
    expect(leerConsultaPersonal({ nombre: ['Ana', 'Luz'], pagina: ['2'] })).toEqual({ nombre: 'Ana', pagina: 2 })
  })
})

describe('parametrosDeConsultaPersonal', () => {
  it('escribe solo lo que se aparta del valor por defecto', () => {
    expect(parametrosDeConsultaPersonal({ nombre: '', pagina: 1 })).toEqual({})
    expect(parametrosDeConsultaPersonal({ nombre: ' Ana ', pagina: 2 })).toEqual({ nombre: 'Ana', pagina: '2' })
    expect(parametrosDeConsultaPersonal({ nombre: '', pagina: 4 })).toEqual({ pagina: '4' })
  })

  it('ida y vuelta: lo que se escribe se lee igual', () => {
    const consulta = { nombre: 'Ana', pagina: 3 }
    expect(leerConsultaPersonal(parametrosDeConsultaPersonal(consulta))).toEqual(consulta)
  })
})

describe('sinParametrosDePersonal', () => {
  it('quita nombre y página y conserva los demás', () => {
    expect(sinParametrosDePersonal({ otra: '1', nombre: 'Ana', pagina: '2' })).toEqual({ otra: '1' })
  })
})
