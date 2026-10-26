import { describe, expect, it } from 'vitest'

import { estadoDeOcupacion, type EstadoOcupacion } from './ocupacion'

// [capacidad, ocupación actual, estado esperado]
const casos: [number, number, EstadoOcupacion][] = [
  // Capacidad 0: no hay lugares nunca.
  [0, 0, 'lleno'],
  [0, 3, 'lleno'],
  // Capacidad 1: vacía está disponible (casi lleno pide al menos una persona adentro); con una persona, llena.
  [1, 0, 'disponible'],
  [1, 1, 'lleno'],
  [1, 2, 'lleno'],
  // Capacidad 2 y 3: el umbral es 1 lugar.
  [2, 0, 'disponible'],
  [2, 1, 'casi-lleno'],
  [2, 2, 'lleno'],
  [3, 0, 'disponible'],
  [3, 1, 'disponible'],
  [3, 2, 'casi-lleno'],
  [3, 3, 'lleno'],
  // Capacidad 10: 10 % son 1 lugar.
  [10, 0, 'disponible'],
  [10, 8, 'disponible'],
  [10, 9, 'casi-lleno'],
  [10, 10, 'lleno'],
  // Capacidad 50: 10 % son 5 lugares.
  [50, 0, 'disponible'],
  [50, 44, 'disponible'],
  [50, 45, 'casi-lleno'],
  [50, 49, 'casi-lleno'],
  [50, 50, 'lleno'],
  // Capacidad 100: 10 % son 10 lugares.
  [100, 0, 'disponible'],
  [100, 89, 'disponible'],
  [100, 90, 'casi-lleno'],
  [100, 99, 'casi-lleno'],
  [100, 100, 'lleno'],
  // Capacidad que no es múltiplo de 10: el umbral se redondea hacia arriba (12 -> 2 lugares, 25 -> 3).
  [12, 9, 'disponible'],
  [12, 10, 'casi-lleno'],
  [25, 21, 'disponible'],
  [25, 22, 'casi-lleno'],
  // Sin errores de coma flotante en capacidades como 30 (el 10 % es exactamente 3).
  [30, 26, 'disponible'],
  [30, 27, 'casi-lleno'],
]

describe('estadoDeOcupacion', () => {
  it.each(casos)('capacidad %i con %i adentro: %s', (maximo, actual, esperado) => {
    expect(estadoDeOcupacion(actual, maximo)).toBe(esperado)
  })

  it('con más gente que capacidad sigue siendo "lleno" (no se rompe)', () => {
    expect(estadoDeOcupacion(120, 100)).toBe('lleno')
    expect(estadoDeOcupacion(1000, 10)).toBe('lleno')
  })

  it('una sede vacía nunca está "casi llena", de cualquier capacidad', () => {
    for (const maximo of [1, 2, 3, 10, 50, 100]) expect(estadoDeOcupacion(0, maximo)).toBe('disponible')
  })

  it('una capacidad negativa tampoco tiene lugares', () => {
    expect(estadoDeOcupacion(0, -5)).toBe('lleno')
  })

  it('los estados avanzan en orden a medida que se llena la sede', () => {
    const orden = Array.from({ length: 51 }, (_, actual) => estadoDeOcupacion(actual, 50))

    expect(orden[0]).toBe('disponible')
    expect(orden.indexOf('casi-lleno')).toBe(45)
    expect(orden.indexOf('lleno')).toBe(50)
    expect([...new Set(orden)]).toEqual(['disponible', 'casi-lleno', 'lleno'])
  })
})
