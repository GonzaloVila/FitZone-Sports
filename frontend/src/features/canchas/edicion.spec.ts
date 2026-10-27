import { describe, expect, it } from 'vitest'
import { MENSAJE_COSTO_INVALIDO, cambiosDe, formularioDe, nombreDeCancha, resumenDeCambios, validarEdicion } from './edicion'
import type { Cancha } from './services/servicioCanchas'

const cancha: Cancha = { id: 4, sedeId: 2, tipo: 'FUTBOL5', costoPorHora: 8000, estado: 'OPERATIVA' }

// Espacios no separables que mete Intl entre el símbolo y el número.
const sinEspeciales = (texto: string) => texto.replace(/ /g, ' ')

describe('formularioDe', () => {
  it('arranca con el costo y el estado actuales de la cancha', () => {
    expect(formularioDe(cancha)).toEqual({ costoPorHora: '8000', estado: 'OPERATIVA' })
  })
})

describe('validarEdicion', () => {
  it('con un costo y un estado válidos no hay errores', () => {
    expect(validarEdicion({ costoPorHora: '8000', estado: 'EN_MANTENIMIENTO' })).toEqual({})
    expect(validarEdicion({ costoPorHora: '0', estado: 'OPERATIVA' })).toEqual({})
  })

  it('acepta un costo que llega como número (como lo entrega un campo numérico)', () => {
    expect(validarEdicion({ costoPorHora: 10000 as unknown as string, estado: 'OPERATIVA' })).toEqual({})
  })

  it('un costo vacío, nulo, negativo o que no es un número es inválido, sin lanzar una excepción', () => {
    for (const costo of ['', '  ', null, undefined, '-1', -5, 'abc']) {
      expect(validarEdicion({ costoPorHora: costo as unknown as string, estado: 'OPERATIVA' }).costoPorHora, String(costo)).toBe(
        MENSAJE_COSTO_INVALIDO,
      )
    }
  })

  it('un estado fuera de los dos conocidos es inválido', () => {
    expect(validarEdicion({ costoPorHora: '5000', estado: 'ROTA' }).estado).toBe('Elegí el estado de la cancha.')
    expect(validarEdicion({ costoPorHora: '5000', estado: '' }).estado).toBeTruthy()
  })
})

describe('cambiosDe', () => {
  it('sin cambios devuelve un objeto vacío', () => {
    expect(cambiosDe(cancha, formularioDe(cancha))).toEqual({})
  })

  it('manda solo lo que cambió', () => {
    expect(cambiosDe(cancha, { costoPorHora: '9500', estado: 'OPERATIVA' })).toEqual({ costoPorHora: 9500 })
    expect(cambiosDe(cancha, { costoPorHora: '8000', estado: 'EN_MANTENIMIENTO' })).toEqual({ estado: 'EN_MANTENIMIENTO' })
    expect(cambiosDe(cancha, { costoPorHora: '0', estado: 'EN_MANTENIMIENTO' })).toEqual({
      costoPorHora: 0,
      estado: 'EN_MANTENIMIENTO',
    })
  })

  it('un costo numérico igual al actual no cuenta como cambio', () => {
    expect(cambiosDe(cancha, { costoPorHora: 8000 as unknown as string, estado: 'OPERATIVA' })).toEqual({})
  })
})

describe('resumenDeCambios', () => {
  it('nombra la cancha y dice el cambio de costo', () => {
    const resumen = resumenDeCambios(cancha, { ...cancha, costoPorHora: 9500 })

    expect(resumen.titulo).toBe('Cancha actualizada')
    expect(sinEspeciales(resumen.descripcion)).toBe('Fútbol 5 #4. El costo por hora pasó de $ 8.000,00 a $ 9.500,00.')
  })

  it('dice si pasó a mantenimiento o volvió a estar operativa', () => {
    expect(resumenDeCambios(cancha, { ...cancha, estado: 'EN_MANTENIMIENTO' }).descripcion).toBe(
      'Fútbol 5 #4. La cancha pasó a mantenimiento.',
    )
    expect(resumenDeCambios({ ...cancha, estado: 'EN_MANTENIMIENTO' }, cancha).descripcion).toBe(
      'Fútbol 5 #4. La cancha volvió a estar operativa.',
    )
  })

  it('junta los dos cambios en una frase', () => {
    const descripcion = sinEspeciales(
      resumenDeCambios(cancha, { ...cancha, costoPorHora: 7000, estado: 'EN_MANTENIMIENTO' }).descripcion,
    )

    expect(descripcion).toContain('El costo por hora pasó de $ 8.000,00 a $ 7.000,00.')
    expect(descripcion).toContain('La cancha pasó a mantenimiento.')
  })
})

describe('nombreDeCancha', () => {
  it('es el deporte y el número', () => {
    expect(nombreDeCancha({ tipo: 'PADDLE', id: 9 })).toBe('Paddle #9')
  })
})
