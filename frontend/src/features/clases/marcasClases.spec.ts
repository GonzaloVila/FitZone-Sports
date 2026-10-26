import { describe, expect, it } from 'vitest'
import { PRESENTACION_MARCA, marcasDeClases } from './marcasClases'
import type { EstadoEspera, EstadoReservaClase } from './services/servicioClases'

const clases = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
const reserva = (claseId: number, estado: EstadoReservaClase) => ({ claseId, estado })
const espera = (claseId: number, estado: EstadoEspera) => ({ claseId, estado })

describe('marcasDeClases', () => {
  it('sin reservas ni esperas no marca nada', () => {
    expect(marcasDeClases(clases, [], []).size).toBe(0)
  })

  it('marca "reservada" la clase con una reserva confirmada', () => {
    expect(marcasDeClases(clases, [reserva(2, 'CONFIRMADA')], []).get(2)).toBe('reservada')
  })

  it('marca "en espera" la clase con una espera en espera y "cupo disponible" la notificada', () => {
    const marcas = marcasDeClases(clases, [], [espera(1, 'EN_ESPERA'), espera(3, 'NOTIFICADO')])

    expect(marcas.get(1)).toBe('en-espera')
    expect(marcas.get(3)).toBe('cupo-disponible')
  })

  it('las canceladas no marcan, aunque el listado las traiga', () => {
    const marcas = marcasDeClases(
      clases,
      [reserva(1, 'CANCELADA')],
      [espera(2, 'CANCELADO'), espera(3, 'CONFIRMADO')],
    )

    expect(marcas.size).toBe(0)
  })

  it('una cancelada y otra vigente de la misma clase: marca la vigente', () => {
    const marcas = marcasDeClases(
      clases,
      [reserva(1, 'CANCELADA'), reserva(1, 'CONFIRMADA')],
      [espera(2, 'CANCELADO'), espera(2, 'EN_ESPERA')],
    )

    expect(marcas.get(1)).toBe('reservada')
    expect(marcas.get(2)).toBe('en-espera')
  })

  it('si hubiera reserva y espera en la misma clase, gana la reserva', () => {
    expect(marcasDeClases(clases, [reserva(1, 'CONFIRMADA')], [espera(1, 'EN_ESPERA')]).get(1)).toBe('reservada')
  })

  it('solo figuran las clases del listado: lo de otras clases se ignora', () => {
    const marcas = marcasDeClases([{ id: 1 }], [reserva(1, 'CONFIRMADA'), reserva(9, 'CONFIRMADA')], [espera(8, 'EN_ESPERA')])

    expect([...marcas.keys()]).toEqual([1])
  })
})

describe('PRESENTACION_MARCA', () => {
  it('cada marca se lee por su texto: "Reservada" con tilde, "En espera" y "Cupo disponible" sin ícono', () => {
    expect(PRESENTACION_MARCA.reservada).toEqual({ etiqueta: 'Reservada', variante: 'exito', conTilde: true })
    expect(PRESENTACION_MARCA['en-espera']).toEqual({ etiqueta: 'En espera', variante: 'neutra', conTilde: false })
    expect(PRESENTACION_MARCA['cupo-disponible'].etiqueta).toBe('Cupo disponible')
  })
})
