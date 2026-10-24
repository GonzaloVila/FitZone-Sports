import { describe, expect, it } from 'vitest'

import {
  estadoDeTurno,
  puedeCancelarse,
  puedePagarse,
  situacionDeReserva,
} from './presentacion'
import type { EstadoReserva } from './services/servicioCanchas'

const AHORA = new Date('2026-10-23T20:00:00-03:00')

function iso(hora: number): string {
  return `2026-10-23T${String(hora).padStart(2, '0')}:00:00-03:00`
}

function reserva(
  cambios: { estado?: EstadoReserva; fechaHoraInicio?: string; fechaHoraFin?: string } = {},
) {
  return {
    estado: 'CONFIRMADA' as EstadoReserva,
    fechaHoraInicio: iso(21),
    fechaHoraFin: iso(22),
    ...cambios,
  }
}

describe('puedePagarse', () => {
  it('solo las confirmadas y las cumplidas se pueden cobrar', () => {
    expect(puedePagarse('CONFIRMADA')).toBe(true)
    expect(puedePagarse('CUMPLIDA')).toBe(true)
    expect(puedePagarse('CANCELADA')).toBe(false)
  })
})

describe('puedeCancelarse', () => {
  it('solo una confirmada cuyo turno todavía no empezó', () => {
    expect(puedeCancelarse(reserva(), AHORA)).toBe(true)
    expect(puedeCancelarse(reserva({ fechaHoraInicio: iso(19), fechaHoraFin: iso(21) }), AHORA)).toBe(false)
    expect(puedeCancelarse(reserva({ fechaHoraInicio: iso(18), fechaHoraFin: iso(19) }), AHORA)).toBe(false)
    expect(puedeCancelarse(reserva({ estado: 'CANCELADA' }), AHORA)).toBe(false)
  })
})

describe('situacionDeReserva', () => {
  it('deriva próxima, en curso, cumplida y cancelada', () => {
    expect(situacionDeReserva(reserva(), AHORA)).toBe('proxima')
    expect(situacionDeReserva(reserva({ fechaHoraInicio: iso(19), fechaHoraFin: iso(21) }), AHORA)).toBe(
      'en-curso',
    )
    expect(situacionDeReserva(reserva({ fechaHoraInicio: iso(18), fechaHoraFin: iso(19) }), AHORA)).toBe(
      'cumplida',
    )
    expect(situacionDeReserva(reserva({ estado: 'CANCELADA' }), AHORA)).toBe('cancelada')
  })
})

describe('estadoDeTurno', () => {
  const turno = (inicio: string, fin: string, disponible = true) => ({
    fechaHoraInicio: inicio,
    fechaHoraFin: fin,
    disponible,
  })

  it('el pasado no está disponible', () => {
    expect(estadoDeTurno(turno(iso(19), iso(20)), false, [], AHORA)).toBe('pasado')
  })

  it('sin mantenimiento refleja la disponibilidad del servidor', () => {
    expect(estadoDeTurno(turno(iso(21), iso(22)), false, [], AHORA)).toBe('libre')
    expect(estadoDeTurno(turno(iso(21), iso(22), false), false, [], AHORA)).toBe('ocupado')
  })

  it('en mantenimiento distingue las reservas existentes del resto', () => {
    expect(estadoDeTurno(turno(iso(21), iso(22)), true, [], AHORA)).toBe('mantenimiento')
    const reservada = { fechaHoraInicio: iso(21), fechaHoraFin: iso(22) }
    expect(estadoDeTurno(turno(iso(21), iso(22)), true, [reservada], AHORA)).toBe('ocupado')
  })
})
