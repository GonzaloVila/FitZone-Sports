import { describe, expect, it } from 'vitest'

import {
  accionesDeReserva,
  insigniaDePago,
  puedeCancelarse,
  puedePagarse,
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

describe('insigniaDePago', () => {
  it('en Próximas: Pagada o Pendiente de pago', () => {
    expect(insigniaDePago('pagada', 'proximas')).toEqual({ texto: 'Pagada', variante: 'exito' })
    expect(insigniaDePago('pendiente', 'proximas')).toEqual({ texto: 'Pendiente de pago', variante: 'advertencia' })
  })

  it('en Pasadas y Canceladas: Pagada o Sin pago', () => {
    for (const pestana of ['pasadas', 'canceladas'] as const) {
      expect(insigniaDePago('pagada', pestana)).toEqual({ texto: 'Pagada', variante: 'exito' })
      expect(insigniaDePago('pendiente', pestana)).toEqual({ texto: 'Sin pago', variante: 'neutra' })
    }
  })

  it('mientras no se sabe si está paga no afirma nada', () => {
    expect(insigniaDePago('cargando', 'proximas')).toBeNull()
    expect(insigniaDePago('sin-dato', 'pasadas')).toBeNull()
  })
})

describe('accionesDeReserva', () => {
  const claves = (acciones: { clave: string }[]) => acciones.map((accion) => accion.clave)

  it('sin pago y con el turno por empezar: Pagar y Cancelar', () => {
    expect(claves(accionesDeReserva(reserva(), 'pendiente', AHORA))).toEqual(['pagar', 'cancelar'])
  })

  it('con el pago aprobado no se ofrece Pagar, pero sí Cancelar', () => {
    expect(claves(accionesDeReserva(reserva(), 'pagada', AHORA))).toEqual(['cancelar'])
  })

  it('con el turno en curso no se ofrece Cancelar', () => {
    const enCurso = reserva({ fechaHoraInicio: iso(19), fechaHoraFin: iso(21) })

    expect(claves(accionesDeReserva(enCurso, 'pendiente', AHORA))).toEqual(['pagar'])
    expect(accionesDeReserva(enCurso, 'pagada', AHORA)).toEqual([])
  })

  it('mientras se consulta el pago, Pagar se ve pero deshabilitada', () => {
    expect(accionesDeReserva(reserva(), 'cargando', AHORA)).toEqual([{ clave: 'pagar', deshabilitada: true }, { clave: 'cancelar' }])
  })

  it('si la consulta del pago falló igual se puede intentar pagar (el servidor decide)', () => {
    expect(claves(accionesDeReserva(reserva(), 'sin-dato', AHORA))).toEqual(['pagar', 'cancelar'])
  })

  it('una reserva cancelada no tiene acciones', () => {
    expect(accionesDeReserva(reserva({ estado: 'CANCELADA' }), 'pendiente', AHORA)).toEqual([])
  })
})
