import { describe, expect, it } from 'vitest'
import {
  PARAMETROS_DESDE_MIS_CLASES,
  destinoVolver,
  leerConsultaAgenda,
  leerConsultaMisClases,
  parametrosDeConsulta,
  parametrosDeConsultaMisClases,
  parametrosDesdeAgenda,
  sinParametrosDeAgenda,
  sinParametrosDeMisClases,
} from './direccion'

describe('Mis clases en la dirección', () => {
  it('sin parámetros: Próximas, página 1', () => {
    expect(leerConsultaMisClases({})).toEqual({ pestana: 'proximas', pagina: 1 })
  })

  it('lee la pestaña y la página (que lleva su propio nombre: `pagina` es la de la agenda)', () => {
    expect(leerConsultaMisClases({ pestana: 'pasadas', 'pagina-clases': '2' })).toEqual({ pestana: 'pasadas', pagina: 2 })
    expect(leerConsultaMisClases({ pagina: '5' }).pagina).toBe(1)
  })

  it('una pestaña desconocida o una página inválida se ignoran como si no estuvieran', () => {
    expect(leerConsultaMisClases({ pestana: 'futuras' }).pestana).toBe('proximas')
    for (const pagina of ['0', '-1', 'abc', '1.5', '', ' 2']) {
      expect(leerConsultaMisClases({ 'pagina-clases': pagina }).pagina, pagina).toBe(1)
    }
  })

  it('solo escribe lo que se aparta de Próximas, página 1', () => {
    expect(parametrosDeConsultaMisClases({ pestana: 'proximas', pagina: 1 })).toEqual({})
    expect(parametrosDeConsultaMisClases({ pestana: 'pasadas', pagina: 1 })).toEqual({ pestana: 'pasadas' })
    expect(parametrosDeConsultaMisClases({ pestana: 'pasadas', pagina: 3 })).toEqual({
      pestana: 'pasadas',
      'pagina-clases': '3',
    })
  })

  it('sacar la pestaña y la página deja lo demás, incluida la página de la agenda', () => {
    const query = { vista: 'mis-clases', pestana: 'pasadas', 'pagina-clases': '2', pagina: '4', sede: '1' }

    expect(sinParametrosDeMisClases(query)).toEqual({ vista: 'mis-clases', pagina: '4', sede: '1' })
  })
})

describe('leerConsultaAgenda', () => {
  it('sin parámetros: sin filtro de disciplina, sede por defecto (null) y página 1', () => {
    expect(leerConsultaAgenda({})).toEqual({ tipo: '', sede: null, pagina: 1 })
  })

  it('lee disciplina, sede y página', () => {
    expect(leerConsultaAgenda({ tipo: ' Yoga ', sede: '3', pagina: '2' })).toEqual({ tipo: 'Yoga', sede: '3', pagina: 2 })
  })

  it('"todas" es una elección explícita y se distingue de la ausencia', () => {
    expect(leerConsultaAgenda({ sede: 'todas' }).sede).toBe('')
    expect(leerConsultaAgenda({}).sede).toBeNull()
  })

  it('una sede inválida o desconocida se ignora como si no estuviera', () => {
    for (const sede of ['abc', '0', '-1', '1.5', '', ' 2', '1e3', 'TODAS']) {
      expect(leerConsultaAgenda({ sede }).sede).toBeNull()
    }
  })

  it('una página inválida vuelve a la 1', () => {
    for (const pagina of ['0', '-2', 'x', '1.5', '', '99999999999999999999']) {
      expect(leerConsultaAgenda({ pagina }).pagina).toBe(1)
    }
  })

  it('un parámetro repetido vale como el primero y uno que no es texto se ignora', () => {
    expect(leerConsultaAgenda({ sede: ['4', '5'], pagina: ['3'] })).toEqual({ tipo: '', sede: '4', pagina: 3 })
    expect(leerConsultaAgenda({ tipo: null, sede: [null], pagina: 7 })).toEqual({ tipo: '', sede: null, pagina: 1 })
  })
})

describe('parametrosDeConsulta', () => {
  it('sin filtros no escribe nada', () => {
    expect(parametrosDeConsulta({ tipo: '', sede: null, pagina: 1 })).toEqual({})
  })

  it('escribe solo lo que se aparta del valor por defecto', () => {
    expect(parametrosDeConsulta({ tipo: ' Yoga ', sede: '3', pagina: 2 })).toEqual({ tipo: 'Yoga', sede: '3', pagina: '2' })
    expect(parametrosDeConsulta({ tipo: '', sede: null, pagina: 4 })).toEqual({ pagina: '4' })
  })

  it('"todas las sedes" se escribe como sede=todas', () => {
    expect(parametrosDeConsulta({ tipo: '', sede: '', pagina: 1 })).toEqual({ sede: 'todas' })
  })

  it('ida y vuelta: lo que se escribe se lee igual', () => {
    const consultas = [
      { tipo: 'Spinning', sede: '2', pagina: 3 },
      { tipo: '', sede: '', pagina: 1 },
      { tipo: 'Yoga', sede: null, pagina: 1 },
    ]
    for (const consulta of consultas) {
      expect(leerConsultaAgenda(parametrosDeConsulta(consulta))).toEqual(consulta)
    }
  })
})

describe('sinParametrosDeAgenda', () => {
  it('quita los de la agenda y conserva los demás (la vista, por ejemplo)', () => {
    expect(sinParametrosDeAgenda({ vista: 'mis-clases', tipo: 'Yoga', sede: '3', pagina: '2' })).toEqual({
      vista: 'mis-clases',
    })
  })
})

describe('parametros de los enlaces al detalle', () => {
  it('desde la agenda lleva el origen y los filtros', () => {
    expect(parametrosDesdeAgenda({ tipo: 'Yoga', sede: '', pagina: 2 })).toEqual({
      desde: 'agenda',
      tipo: 'Yoga',
      sede: 'todas',
      pagina: '2',
    })
    expect(parametrosDesdeAgenda({ tipo: '', sede: null, pagina: 1 })).toEqual({ desde: 'agenda' })
  })

  it('desde "Mis clases" lleva solo el origen', () => {
    expect(PARAMETROS_DESDE_MIS_CLASES).toEqual({ desde: 'mis-clases' })
  })
})

describe('destinoVolver', () => {
  it('desde "Mis clases" dice "Volver a mis clases" y vuelve a esa vista', () => {
    expect(destinoVolver({ desde: 'mis-clases' }, true)).toEqual({
      texto: 'Volver a mis clases',
      a: { name: 'clases', query: { vista: 'mis-clases' } },
    })
  })

  it('desde la agenda vuelve con sus filtros intactos', () => {
    expect(destinoVolver({ desde: 'agenda', tipo: 'Yoga', sede: 'todas', pagina: '3' }, true)).toEqual({
      texto: 'Volver a la agenda',
      a: { name: 'clases', query: { tipo: 'Yoga', sede: 'todas', pagina: '3' } },
    })
  })

  it('desde la agenda, los filtros inválidos se descartan sin romper', () => {
    expect(destinoVolver({ desde: 'agenda', tipo: 'Yoga', sede: 'xx', pagina: '-1' }, false).a.query).toEqual({
      tipo: 'Yoga',
    })
  })

  it('sin origen (entrada directa) vuelve a la agenda sin filtros, aunque haya otros parámetros', () => {
    expect(destinoVolver({}, true)).toEqual({ texto: 'Volver a la agenda', a: { name: 'clases', query: {} } })
    expect(destinoVolver({ tipo: 'Yoga', pagina: '2' }, true).a.query).toEqual({})
  })

  it('un origen desconocido se trata como entrada directa', () => {
    for (const desde of ['otra-cosa', '', 'AGENDA', 'mis-clases ', '__proto__']) {
      expect(destinoVolver({ desde, tipo: 'Yoga' }, true)).toEqual({
        texto: 'Volver a la agenda',
        a: { name: 'clases', query: {} },
      })
    }
  })

  it('"Mis clases" es del socio: para el personal ese origen se ignora', () => {
    expect(destinoVolver({ desde: 'mis-clases' }, false)).toEqual({
      texto: 'Volver a la agenda',
      a: { name: 'clases', query: {} },
    })
  })
})
