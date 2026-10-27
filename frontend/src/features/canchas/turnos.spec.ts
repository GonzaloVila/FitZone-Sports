import { describe, expect, it } from 'vitest'
import type { EstadoTurno } from './presentacion'
import type { Disponibilidad } from './services/servicioCanchas'
import {
  DIAS_DE_LA_TIRA,
  agruparPorFranja,
  diasDeLaTira,
  esFechaValida,
  fechaDeTurnosDe,
  franjaDe,
  parametrosDeFecha,
  resumenDeTurnos,
  sinFecha,
  sumarDias,
} from './turnos'

const HOY = '2026-11-12' // jueves

const turno = (hora: string, disponible = true): Disponibilidad => ({
  fechaHoraInicio: `${HOY}T${hora}:00-03:00`,
  fechaHoraFin: `${HOY}T${String(Number(hora.slice(0, 2)) + 1).padStart(2, '0')}:${hora.slice(3)}:00-03:00`,
  disponible,
})

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

describe('diasDeLaTira', () => {
  it('son siete días: Hoy, Mañana y los cinco siguientes con su día de la semana', () => {
    const dias = diasDeLaTira(HOY)

    expect(dias).toHaveLength(DIAS_DE_LA_TIRA)
    expect(dias.map((dia) => dia.etiqueta)).toEqual(['Hoy', 'Mañana', 'sáb 14', 'dom 15', 'lun 16', 'mar 17', 'mié 18'])
    expect(dias.map((dia) => dia.fecha)).toEqual([
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
    ])
  })

  it('el nombre completo (para el lector de pantalla) dice día de la semana, número y mes', () => {
    const dias = diasDeLaTira(HOY)

    expect(dias[0]?.nombreCompleto).toBe('jueves 12 de noviembre')
    expect(dias[1]?.nombreCompleto).toBe('viernes 13 de noviembre')
  })

  it('cruza el fin de mes', () => {
    const dias = diasDeLaTira('2026-11-29')

    expect(dias.map((dia) => dia.etiqueta)).toEqual(['Hoy', 'Mañana', 'mar 1', 'mié 2', 'jue 3', 'vie 4', 'sáb 5'])
    expect(dias[2]?.nombreCompleto).toBe('martes 1 de diciembre')
  })
})

describe('fechaDeTurnosDe', () => {
  it('sin ?fecha= vale hoy', () => {
    expect(fechaDeTurnosDe({}, HOY)).toBe(HOY)
  })

  it('una fecha de la tira se respeta, incluidos el primer y el último día', () => {
    expect(fechaDeTurnosDe({ fecha: '2026-11-14' }, HOY)).toBe('2026-11-14')
    expect(fechaDeTurnosDe({ fecha: '2026-11-12' }, HOY)).toBe(HOY)
    expect(fechaDeTurnosDe({ fecha: '2026-11-18' }, HOY)).toBe('2026-11-18')
  })

  it('una fecha inválida, pasada o fuera de la tira vale hoy', () => {
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

  it('ida y vuelta: lo que se escribe se lee igual', () => {
    for (const fecha of diasDeLaTira(HOY).map((dia) => dia.fecha)) {
      expect(fechaDeTurnosDe(parametrosDeFecha(fecha, HOY), HOY)).toBe(fecha)
    }
  })

  it('sinFecha quita la fecha y conserva el origen y los filtros', () => {
    expect(sinFecha({ desde: 'canchas', sede: '2', fecha: '2026-11-14' })).toEqual({ desde: 'canchas', sede: '2' })
  })
})

describe('franjaDe', () => {
  it('mañana hasta las 12, tarde hasta las 19 y noche desde las 19 (hora de la sede)', () => {
    expect(franjaDe(`${HOY}T07:00:00-03:00`)).toBe('manana')
    expect(franjaDe(`${HOY}T11:30:00-03:00`)).toBe('manana')
    expect(franjaDe(`${HOY}T12:00:00-03:00`)).toBe('tarde')
    expect(franjaDe(`${HOY}T18:59:00-03:00`)).toBe('tarde')
    expect(franjaDe(`${HOY}T19:00:00-03:00`)).toBe('noche')
    expect(franjaDe(`${HOY}T23:00:00-03:00`)).toBe('noche')
  })

  it('usa la hora de la sede aunque el instante llegue en otra zona', () => {
    // 14:00 UTC son las 11:00 en Buenos Aires: mañana.
    expect(franjaDe(`${HOY}T14:00:00Z`)).toBe('manana')
  })
})

describe('agruparPorFranja', () => {
  const todosLibres = () => 'libre' as EstadoTurno

  it('agrupa en Mañana, Tarde y Noche, en ese orden y con los turnos por hora', () => {
    const grupos = agruparPorFranja([turno('20:00'), turno('09:00'), turno('15:00'), turno('10:00'), turno('19:00')], todosLibres)

    expect(grupos.map((grupo) => grupo.etiqueta)).toEqual(['Mañana', 'Tarde', 'Noche'])
    expect(grupos.map((grupo) => grupo.turnos.length)).toEqual([2, 1, 2])
    expect(grupos[0]?.turnos.map((item) => item.turno.fechaHoraInicio.slice(11, 16))).toEqual(['09:00', '10:00'])
    expect(grupos[2]?.turnos.map((item) => item.turno.fechaHoraInicio.slice(11, 16))).toEqual(['19:00', '20:00'])
  })

  it('las franjas sin turnos no aparecen', () => {
    const grupos = agruparPorFranja([turno('20:00'), turno('21:00')], todosLibres)

    expect(grupos.map((grupo) => grupo.franja)).toEqual(['noche'])
  })

  it('sin turnos no hay grupos', () => {
    expect(agruparPorFranja([], todosLibres)).toEqual([])
  })

  it('cada turno lleva el estado que le da quien agrupa', () => {
    const ocupado = turno('10:00', false)
    const grupos = agruparPorFranja([turno('09:00'), ocupado], (t) => (t.disponible ? 'libre' : 'ocupado'))

    expect(grupos[0]?.turnos.map((item) => item.estado)).toEqual(['libre', 'ocupado'])
  })

  it('no modifica la lista que recibe', () => {
    const original = [turno('20:00'), turno('09:00')]
    agruparPorFranja(original, todosLibres)

    expect(original[0]?.fechaHoraInicio).toContain('T20:00')
  })
})

describe('resumenDeTurnos', () => {
  const estados = (...lista: EstadoTurno[]) => lista.map((estado) => ({ estado }))

  it('dice cuántos turnos libres y cuántos ocupados', () => {
    expect(resumenDeTurnos(estados('libre', 'libre', 'libre', 'ocupado', 'ocupado'))).toBe('3 libres · 2 ocupados')
  })

  it('usa el singular con uno y no cuenta los pasados ni los de mantenimiento', () => {
    expect(resumenDeTurnos(estados('libre', 'ocupado', 'pasado', 'pasado', 'mantenimiento'))).toBe('1 libre · 1 ocupado')
  })

  it('sin turnos dice cero', () => {
    expect(resumenDeTurnos([])).toBe('0 libres · 0 ocupados')
  })
})
