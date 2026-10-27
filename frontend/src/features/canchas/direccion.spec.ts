import { describe, expect, it } from 'vitest'
import {
  PARAMETROS_DESDE_MIS_RESERVAS,
  destinoVolver,
  leerConsultaCanchas,
  parametrosDeConsultaCanchas,
  parametrosDesdeCanchas,
  sinParametrosDeCanchas,
} from './direccion'

describe('leerConsultaCanchas', () => {
  it('sin parámetros: sede por defecto (null), todos los estados y página 1', () => {
    expect(leerConsultaCanchas({})).toEqual({ sede: null, estado: '', pagina: 1 })
  })

  it('lee sede, estado y página', () => {
    expect(leerConsultaCanchas({ sede: '3', estado: 'EN_MANTENIMIENTO', pagina: '2' })).toEqual({
      sede: '3',
      estado: 'EN_MANTENIMIENTO',
      pagina: 2,
    })
  })

  it('una sede, un estado o una página inválidos se ignoran como si no estuvieran', () => {
    for (const sede of ['abc', '0', '-1', '1.5', '', ' 2', 'todas']) {
      expect(leerConsultaCanchas({ sede }).sede).toBeNull()
    }
    for (const estado of ['operativa', 'OTRO', '', '__proto__']) {
      expect(leerConsultaCanchas({ estado }).estado).toBe('')
    }
    for (const pagina of ['0', '-2', 'x', '1.5', '']) {
      expect(leerConsultaCanchas({ pagina }).pagina).toBe(1)
    }
  })

  it('un parámetro repetido vale como el primero y uno que no es texto se ignora', () => {
    expect(leerConsultaCanchas({ sede: ['4', '5'], estado: ['OPERATIVA'] })).toEqual({
      sede: '4',
      estado: 'OPERATIVA',
      pagina: 1,
    })
    expect(leerConsultaCanchas({ sede: null, estado: [null], pagina: 7 })).toEqual({ sede: null, estado: '', pagina: 1 })
  })
})

describe('parametrosDeConsultaCanchas', () => {
  it('escribe solo lo que se aparta del valor por defecto', () => {
    expect(parametrosDeConsultaCanchas({ sede: null, estado: '', pagina: 1 })).toEqual({})
    expect(parametrosDeConsultaCanchas({ sede: '3', estado: 'OPERATIVA', pagina: 2 })).toEqual({
      sede: '3',
      estado: 'OPERATIVA',
      pagina: '2',
    })
    expect(parametrosDeConsultaCanchas({ sede: null, estado: '', pagina: 4 })).toEqual({ pagina: '4' })
  })

  it('ida y vuelta: lo que se escribe se lee igual', () => {
    const consultas = [
      { sede: '2', estado: 'EN_MANTENIMIENTO', pagina: 3 },
      { sede: null, estado: '', pagina: 1 },
      { sede: '7', estado: '', pagina: 1 },
    ]
    for (const consulta of consultas) {
      expect(leerConsultaCanchas(parametrosDeConsultaCanchas(consulta))).toEqual(consulta)
    }
  })
})

describe('sinParametrosDeCanchas', () => {
  it('quita los de la lista y conserva los demás (la vista, por ejemplo)', () => {
    expect(sinParametrosDeCanchas({ vista: 'mis-reservas', sede: '3', estado: 'OPERATIVA', pagina: '2' })).toEqual({
      vista: 'mis-reservas',
    })
  })
})

describe('parámetros de los enlaces a la grilla', () => {
  it('desde la lista lleva el origen y los filtros', () => {
    expect(parametrosDesdeCanchas({ sede: '3', estado: 'OPERATIVA', pagina: 2 })).toEqual({
      desde: 'canchas',
      sede: '3',
      estado: 'OPERATIVA',
      pagina: '2',
    })
    expect(parametrosDesdeCanchas({ sede: null, estado: '', pagina: 1 })).toEqual({ desde: 'canchas' })
  })

  it('desde "Mis reservas" lleva solo el origen', () => {
    expect(PARAMETROS_DESDE_MIS_RESERVAS).toEqual({ desde: 'mis-reservas' })
  })
})

describe('destinoVolver', () => {
  it('desde "Mis reservas" dice "Volver a mis reservas" y vuelve a esa vista', () => {
    expect(destinoVolver({ desde: 'mis-reservas' }, true)).toEqual({
      texto: 'Volver a mis reservas',
      a: { name: 'canchas', query: { vista: 'mis-reservas' } },
    })
  })

  it('desde la lista vuelve con sus filtros intactos', () => {
    expect(destinoVolver({ desde: 'canchas', sede: '3', estado: 'OPERATIVA', pagina: '3' }, true)).toEqual({
      texto: 'Volver a canchas',
      a: { name: 'canchas', query: { sede: '3', estado: 'OPERATIVA', pagina: '3' } },
    })
  })

  it('desde la lista, los filtros inválidos se descartan sin romper', () => {
    expect(destinoVolver({ desde: 'canchas', sede: 'xx', estado: 'raro', pagina: '-1' }, false).a.query).toEqual({})
  })

  it('sin origen (entrada directa) vuelve a la lista sin filtros, aunque haya otros parámetros', () => {
    expect(destinoVolver({}, true)).toEqual({ texto: 'Volver a canchas', a: { name: 'canchas', query: {} } })
    expect(destinoVolver({ sede: '2', pagina: '2' }, true).a.query).toEqual({})
  })

  it('un origen desconocido se trata como entrada directa', () => {
    for (const desde of ['otra-cosa', '', 'CANCHAS', 'mis-reservas ', '__proto__']) {
      expect(destinoVolver({ desde, sede: '2' }, true)).toEqual({
        texto: 'Volver a canchas',
        a: { name: 'canchas', query: {} },
      })
    }
  })

  it('"Mis reservas" es de quien reserva: para el personal ese origen se ignora', () => {
    expect(destinoVolver({ desde: 'mis-reservas' }, false)).toEqual({
      texto: 'Volver a canchas',
      a: { name: 'canchas', query: {} },
    })
  })
})
