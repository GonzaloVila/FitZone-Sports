import { describe, expect, it } from 'vitest'
import {
  destinoVolver,
  leerConsultaCanchas,
  leerConsultaMisReservas,
  parametrosDeConsultaCanchas,
  parametrosDeConsultaMisReservas,
  parametrosDesdeCanchas,
  reservaAPagarDe,
  sinParametrosDeCanchas,
  sinParametrosDeMisReservas,
  sinParametrosDeVistaMisReservas,
  sinReservaAPagar,
} from './direccion'

const consultaVacia = { sede: null, tipo: '', estado: '', pagina: 1 }

describe('Mis reservas en la dirección', () => {
  it('sin parámetros: Próximas, página 1', () => {
    expect(leerConsultaMisReservas({})).toEqual({ pestana: 'proximas', pagina: 1 })
  })

  it('lee la pestaña y la página (que lleva su propio nombre: `pagina` es la de la lista de canchas)', () => {
    expect(leerConsultaMisReservas({ pestana: 'canceladas', 'pagina-reservas': '3' })).toEqual({ pestana: 'canceladas', pagina: 3 })
    expect(leerConsultaMisReservas({ pagina: '5' }).pagina).toBe(1)
  })

  it('una pestaña desconocida o una página inválida se ignoran como si no estuvieran', () => {
    expect(leerConsultaMisReservas({ pestana: 'futuras' }).pestana).toBe('proximas')
    for (const pagina of ['0', '-1', 'abc', '1.5', '']) {
      expect(leerConsultaMisReservas({ 'pagina-reservas': pagina }).pagina, pagina).toBe(1)
    }
  })

  it('solo escribe lo que se aparta de Próximas, página 1', () => {
    expect(parametrosDeConsultaMisReservas({ pestana: 'proximas', pagina: 1 })).toEqual({})
    expect(parametrosDeConsultaMisReservas({ pestana: 'pasadas', pagina: 1 })).toEqual({ pestana: 'pasadas' })
    expect(parametrosDeConsultaMisReservas({ pestana: 'proximas', pagina: 2 })).toEqual({ 'pagina-reservas': '2' })
  })

  it('sacar los parámetros de la pestaña y la página deja lo demás (la vista y la reserva a pagar)', () => {
    const query = { vista: 'mis-reservas', pestana: 'pasadas', 'pagina-reservas': '2', pagar: '9', sede: '1' }

    expect(sinParametrosDeMisReservas(query)).toEqual({ vista: 'mis-reservas', pagar: '9', sede: '1' })
  })

  it('al salir de Mis reservas no queda nada de ella (tampoco la reserva a pagar)', () => {
    const query = { vista: 'mis-reservas', pestana: 'pasadas', 'pagina-reservas': '2', pagar: '9', sede: '1' }

    expect(sinParametrosDeVistaMisReservas(query)).toEqual({ vista: 'mis-reservas', sede: '1' })
  })

  it('?pagar= es el id de la reserva a pagar; uno inválido se ignora', () => {
    expect(reservaAPagarDe({ pagar: '12' })).toBe(12)
    expect(reservaAPagarDe({})).toBeNull()
    for (const pagar of ['0', '-3', 'abc', '1.5', '', ' 2']) {
      expect(reservaAPagarDe({ pagar }), pagar).toBeNull()
    }
    expect(sinReservaAPagar({ vista: 'mis-reservas', pagar: '12' })).toEqual({ vista: 'mis-reservas' })
  })
})

describe('leerConsultaCanchas', () => {
  it('sin parámetros: sede por defecto (null), todos los deportes y estados y página 1', () => {
    expect(leerConsultaCanchas({})).toEqual(consultaVacia)
  })

  it('lee sede, deporte (tipo), estado y página', () => {
    expect(leerConsultaCanchas({ sede: '3', tipo: 'PADDLE', estado: 'EN_MANTENIMIENTO', pagina: '2' })).toEqual({
      sede: '3',
      tipo: 'PADDLE',
      estado: 'EN_MANTENIMIENTO',
      pagina: 2,
    })
  })

  it('?sede=todas es elegir todas las sedes a propósito: se distingue de no tener el parámetro', () => {
    expect(leerConsultaCanchas({ sede: 'todas' }).sede).toBe('')
    expect(leerConsultaCanchas({}).sede).toBeNull()
  })

  it('un tipo desconocido se ignora como si no estuviera', () => {
    for (const tipo of ['paddle', 'TENIS', 'PADDLE,FUTBOL5', ' PADDLE', '', '__proto__']) {
      expect(leerConsultaCanchas({ tipo }).tipo, tipo).toBe('')
    }
  })

  it('una sede, un estado o una página inválidos se ignoran como si no estuvieran', () => {
    for (const sede of ['abc', '0', '-1', '1.5', '', ' 2', 'TODAS']) {
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
    expect(leerConsultaCanchas({ sede: ['4', '5'], tipo: ['FUTBOL5', 'PADDLE'], estado: ['OPERATIVA'] })).toEqual({
      sede: '4',
      tipo: 'FUTBOL5',
      estado: 'OPERATIVA',
      pagina: 1,
    })
    expect(leerConsultaCanchas({ sede: null, tipo: 3, estado: [null], pagina: 7 })).toEqual(consultaVacia)
  })
})

describe('parametrosDeConsultaCanchas', () => {
  it('escribe solo lo que se aparta del valor por defecto', () => {
    expect(parametrosDeConsultaCanchas(consultaVacia)).toEqual({})
    expect(parametrosDeConsultaCanchas({ sede: '3', tipo: 'FUTBOL5', estado: 'OPERATIVA', pagina: 2 })).toEqual({
      sede: '3',
      tipo: 'FUTBOL5',
      estado: 'OPERATIVA',
      pagina: '2',
    })
    expect(parametrosDeConsultaCanchas({ ...consultaVacia, pagina: 4 })).toEqual({ pagina: '4' })
  })

  it('"todas las sedes" elegida a propósito se escribe como sede=todas', () => {
    expect(parametrosDeConsultaCanchas({ ...consultaVacia, sede: '' })).toEqual({ sede: 'todas' })
  })

  it('ida y vuelta: lo que se escribe se lee igual', () => {
    const consultas = [
      { sede: '2', tipo: 'PADDLE', estado: 'EN_MANTENIMIENTO', pagina: 3 },
      consultaVacia,
      { sede: '7', tipo: '', estado: '', pagina: 1 },
      { sede: '', tipo: 'FUTBOL5', estado: '', pagina: 1 },
    ]
    for (const consulta of consultas) {
      expect(leerConsultaCanchas(parametrosDeConsultaCanchas(consulta))).toEqual(consulta)
    }
  })
})

describe('sinParametrosDeCanchas', () => {
  it('quita los de la lista y conserva los demás (la vista, por ejemplo)', () => {
    expect(
      sinParametrosDeCanchas({ vista: 'mis-reservas', sede: '3', tipo: 'PADDLE', estado: 'OPERATIVA', pagina: '2' }),
    ).toEqual({ vista: 'mis-reservas' })
  })
})

describe('parámetros de los enlaces a la grilla', () => {
  it('desde la lista lleva el origen y los filtros', () => {
    expect(parametrosDesdeCanchas({ sede: '3', tipo: 'PADDLE', estado: 'OPERATIVA', pagina: 2 })).toEqual({
      desde: 'canchas',
      sede: '3',
      tipo: 'PADDLE',
      estado: 'OPERATIVA',
      pagina: '2',
    })
    expect(parametrosDesdeCanchas(consultaVacia)).toEqual({ desde: 'canchas' })
    expect(parametrosDesdeCanchas({ ...consultaVacia, sede: '' })).toEqual({ desde: 'canchas', sede: 'todas' })
  })
})

describe('destinoVolver', () => {
  it('desde la lista vuelve con sus filtros intactos', () => {
    expect(destinoVolver({ desde: 'canchas', sede: '3', tipo: 'PADDLE', estado: 'OPERATIVA', pagina: '3' })).toEqual({
      texto: 'Volver a canchas',
      a: { name: 'canchas', query: { sede: '3', tipo: 'PADDLE', estado: 'OPERATIVA', pagina: '3' } },
    })
  })

  it('desde la lista con "todas las sedes" elegida a propósito vuelve con sede=todas', () => {
    expect(destinoVolver({ desde: 'canchas', sede: 'todas' }).a.query).toEqual({ sede: 'todas' })
  })

  it('desde la lista, los filtros inválidos se descartan sin romper', () => {
    expect(destinoVolver({ desde: 'canchas', sede: 'xx', tipo: 'tenis', estado: 'raro', pagina: '-1' }).a.query).toEqual({})
  })

  it('la fecha de la grilla no se arrastra al volver a la lista', () => {
    expect(destinoVolver({ desde: 'canchas', sede: '3', fecha: '2026-11-12' }).a.query).toEqual({ sede: '3' })
  })

  it('sin origen (entrada directa) vuelve a la lista sin filtros, aunque haya otros parámetros', () => {
    expect(destinoVolver({})).toEqual({ texto: 'Volver a canchas', a: { name: 'canchas', query: {} } })
    expect(destinoVolver({ sede: '2', pagina: '2' }).a.query).toEqual({})
  })

  it('un origen desconocido se trata como entrada directa (también el viejo "mis-reservas", que ya nadie genera)', () => {
    for (const desde of ['otra-cosa', '', 'CANCHAS', 'mis-reservas', 'mis-reservas ', '__proto__']) {
      expect(destinoVolver({ desde, sede: '2' })).toEqual({
        texto: 'Volver a canchas',
        a: { name: 'canchas', query: {} },
      })
    }
  })
})
