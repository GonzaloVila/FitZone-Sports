import { describe, expect, it } from 'vitest'
import type { Disponibilidad } from './services/servicioCanchas'
import {
  DIAS_PERMITIDOS,
  clasificarTurnos,
  esFechaValida,
  fechaDeTurnosDe,
  fechaPermitida,
  parametrosDeFecha,
  sinFecha,
  sumarDias,
  ultimaFecha,
} from './turnos'

const HOY = '2026-11-12' // jueves

const turno = (hora: string, disponible = true, dia = HOY): Disponibilidad => ({
  fechaHoraInicio: `${dia}T${hora}:00-03:00`,
  fechaHoraFin: `${dia}T${String(Number(hora.slice(0, 2)) + 1).padStart(2, '0')}:${hora.slice(3)}:00-03:00`,
  disponible,
})

const horas = (lista: ReturnType<typeof clasificarTurnos>) => lista.map((item) => item.turno.fechaHoraInicio.slice(11, 16))
const estados = (lista: ReturnType<typeof clasificarTurnos>) => lista.map((item) => item.estado)

describe('sumarDias', () => {
  it('suma días dentro del mes, cruzando el mes y el año', () => {
    expect(sumarDias('2026-11-12', 1)).toBe('2026-11-13')
    expect(sumarDias('2026-11-28', 5)).toBe('2026-12-03')
    expect(sumarDias('2026-12-29', 4)).toBe('2027-01-02')
  })

  it('maneja los años bisiestos y los días negativos', () => {
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(sumarDias('2027-02-28', 1)).toBe('2027-03-01')
    expect(sumarDias('2026-11-01', -1)).toBe('2026-10-31')
  })

  it('una fecha inválida lanza un error claro', () => {
    expect(() => sumarDias('mañana', 1)).toThrow(RangeError)
  })
})

describe('esFechaValida', () => {
  it('acepta fechas reales y rechaza formatos raros o días que no existen', () => {
    expect(esFechaValida('2026-11-12')).toBe(true)
    expect(esFechaValida('2028-02-29')).toBe(true)
    for (const mala of ['', '2026-11-1', '12/11/2026', '2026-02-30', '2027-02-29', '2026-13-01', 'hoy', '2026-11-12T10:00']) {
      expect(esFechaValida(mala), mala).toBe(false)
    }
  })
})

describe('rango de fechas permitido', () => {
  it('son hoy y los 6 días siguientes: el último día es hoy + 6', () => {
    expect(DIAS_PERMITIDOS).toBe(7)
    expect(ultimaFecha(HOY)).toBe('2026-11-18')
    expect(ultimaFecha('2026-11-29')).toBe('2026-12-05')
  })

  it('fechaPermitida acepta los extremos y rechaza lo de afuera o lo inválido', () => {
    expect(fechaPermitida('2026-11-12', HOY)).toBe(true)
    expect(fechaPermitida('2026-11-18', HOY)).toBe(true)
    expect(fechaPermitida('2026-11-11', HOY)).toBe(false)
    expect(fechaPermitida('2026-11-19', HOY)).toBe(false)
    expect(fechaPermitida('2026-02-30', HOY)).toBe(false)
    expect(fechaPermitida('', HOY)).toBe(false)
  })
})

describe('fechaDeTurnosDe', () => {
  it('sin ?fecha= vale hoy', () => {
    expect(fechaDeTurnosDe({}, HOY)).toBe(HOY)
  })

  it('una fecha del rango se respeta, incluidos el primer y el último día', () => {
    expect(fechaDeTurnosDe({ fecha: '2026-11-14' }, HOY)).toBe('2026-11-14')
    expect(fechaDeTurnosDe({ fecha: '2026-11-12' }, HOY)).toBe(HOY)
    expect(fechaDeTurnosDe({ fecha: '2026-11-18' }, HOY)).toBe('2026-11-18')
  })

  it('una fecha inválida, pasada o fuera del rango vale hoy', () => {
    for (const fecha of ['2026-11-11', '2026-11-19', '2027-01-01', '2026-02-30', 'mañana', '', '12/11/2026']) {
      expect(fechaDeTurnosDe({ fecha }, HOY), fecha).toBe(HOY)
    }
  })

  it('un parámetro repetido vale como el primero y uno que no es texto se ignora', () => {
    expect(fechaDeTurnosDe({ fecha: ['2026-11-15', '2026-11-16'] }, HOY)).toBe('2026-11-15')
    expect(fechaDeTurnosDe({ fecha: 20261115 }, HOY)).toBe(HOY)
    expect(fechaDeTurnosDe({ fecha: null }, HOY)).toBe(HOY)
  })
})

describe('parametrosDeFecha y sinFecha', () => {
  it('hoy no se escribe en la dirección; otro día sí', () => {
    expect(parametrosDeFecha(HOY, HOY)).toEqual({})
    expect(parametrosDeFecha('2026-11-14', HOY)).toEqual({ fecha: '2026-11-14' })
  })

  it('ida y vuelta: lo que se escribe se lee igual en todo el rango', () => {
    for (let dias = 0; dias < DIAS_PERMITIDOS; dias++) {
      const fecha = sumarDias(HOY, dias)
      expect(fechaDeTurnosDe(parametrosDeFecha(fecha, HOY), HOY)).toBe(fecha)
    }
  })

  it('sinFecha quita la fecha y conserva el origen y los filtros', () => {
    expect(sinFecha({ desde: 'canchas', sede: '2', fecha: '2026-11-14' })).toEqual({ desde: 'canchas', sede: '2' })
  })
})

describe('clasificarTurnos', () => {
  const A_LAS_19 = new Date(`${HOY}T19:00:00-03:00`)

  it('devuelve TODOS los turnos del día, también los que ya pasaron, cada uno con su estado', () => {
    const lista = clasificarTurnos([turno('17:00'), turno('18:00'), turno('19:00'), turno('20:00'), turno('21:00', false)], A_LAS_19)

    expect(horas(lista)).toEqual(['17:00', '18:00', '19:00', '20:00', '21:00'])
    expect(estados(lista)).toEqual(['pasado', 'pasado', 'pasado', 'libre', 'ocupado'])
  })

  it('un turno que ya empezó (o que empieza justo ahora) es pasado', () => {
    expect(estados(clasificarTurnos([turno('19:00')], A_LAS_19))).toEqual(['pasado'])
    expect(estados(clasificarTurnos([turno('18:30')], A_LAS_19))).toEqual(['pasado'])
  })

  it('un turno que empieza un minuto después ya no es pasado', () => {
    expect(estados(clasificarTurnos([turno('19:00')], new Date(`${HOY}T18:59:00-03:00`)))).toEqual(['libre'])
  })

  it('el pasado tiene prioridad sobre libre y ocupado', () => {
    const lista = clasificarTurnos([turno('10:00', true), turno('11:00', false)], A_LAS_19)

    expect(estados(lista)).toEqual(['pasado', 'pasado'])
  })

  it('corta en la hora de la sede aunque el instante llegue en otra zona', () => {
    // 22:30 UTC son las 19:30 en la sede: el turno de las 19:00 ya empezó y el de las 20:00 no.
    const ahora = new Date(`${HOY}T22:30:00Z`)

    expect(estados(clasificarTurnos([turno('19:00'), turno('20:00')], ahora))).toEqual(['pasado', 'libre'])
  })

  it('un día futuro no tiene turnos pasados: cada uno es libre u ocupado según el servidor', () => {
    const manana = '2026-11-13'
    const lista = clasificarTurnos([turno('08:00', true, manana), turno('09:00', false, manana)], A_LAS_19)

    expect(estados(lista)).toEqual(['libre', 'ocupado'])
  })

  it('libre u ocupado según la disponibilidad del servidor', () => {
    const lista = clasificarTurnos([turno('20:00', true), turno('21:00', false)], A_LAS_19)

    expect(estados(lista)).toEqual(['libre', 'ocupado'])
  })

  it('los ordena por hora de inicio', () => {
    const lista = clasificarTurnos([turno('22:00'), turno('20:00'), turno('21:00')], A_LAS_19)

    expect(horas(lista)).toEqual(['20:00', '21:00', '22:00'])
  })

  it('sin turnos la lista es vacía', () => {
    expect(clasificarTurnos([], A_LAS_19)).toEqual([])
  })

  it('no modifica la lista que recibe', () => {
    const original = [turno('22:00'), turno('20:00')]
    clasificarTurnos(original, A_LAS_19)

    expect(original[0]?.fechaHoraInicio).toContain('T22:00')
  })
})
