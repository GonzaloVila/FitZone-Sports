import { describe, expect, it } from 'vitest'
import { ESTADOS_CLASE, ETIQUETAS_ESTADO_CLASE, estadoDeClase } from './presentacion'

const AHORA = new Date('2026-05-04T12:00:00-03:00').getTime()

describe('estados de clase del filtro', () => {
  it('tienen la misma etiqueta que muestra la tabla para ese estado', () => {
    expect(ESTADOS_CLASE.map((estado) => ETIQUETAS_ESTADO_CLASE[estado])).toEqual(['Con cupos', 'Sin cupos', 'Comenzada'])
  })
})

describe('estadoDeClase', () => {
  it('una clase que ya empezó figura como comenzada, aunque tenga cupos', () => {
    const estado = estadoDeClase({ horarioInicio: '2026-05-04T11:00:00-03:00', cupoDisponible: 5 }, AHORA)

    expect(estado).toEqual({ etiqueta: 'Comenzada', variante: 'neutra' })
  })

  it('la que empieza justo ahora ya cuenta como comenzada', () => {
    const estado = estadoDeClase({ horarioInicio: '2026-05-04T12:00:00-03:00', cupoDisponible: 5 }, AHORA)

    expect(estado.etiqueta).toBe('Comenzada')
  })

  it('una clase futura sin cupos figura como sin cupos', () => {
    const estado = estadoDeClase({ horarioInicio: '2026-05-04T18:00:00-03:00', cupoDisponible: 0 }, AHORA)

    expect(estado).toEqual({ etiqueta: 'Sin cupos', variante: 'peligro' })
  })

  it('una clase futura con cupos figura como con cupos', () => {
    const estado = estadoDeClase({ horarioInicio: '2026-05-04T18:00:00-03:00', cupoDisponible: 3 }, AHORA)

    expect(estado).toEqual({ etiqueta: 'Con cupos', variante: 'exito' })
  })
})
