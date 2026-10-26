import { describe, expect, it } from 'vitest'

import { sinCodigosDeRequisito } from './sinCodigosDeRequisito'

describe('sinCodigosDeRequisito: mensajes reales del backend', () => {
  it.each([
    [
      'El socio 7 ya tiene un ingreso sin egreso registrado (RN-01).',
      'El socio 7 ya tiene un ingreso sin egreso registrado.',
    ],
    [
      'El socio 7 ya tiene un ingreso sin egreso (RN-01).',
      'El socio 7 ya tiene un ingreso sin egreso.',
    ],
    [
      'La sede 3 alcanzó su aforo máximo (50 personas); no se admiten más ingresos (RF-05).',
      'La sede 3 alcanzó su aforo máximo (50 personas); no se admiten más ingresos.',
    ],
    [
      'La clase 4 alcanzó su capacidad máxima (20). Puede ingresar a la lista de espera (RF-08).',
      'La clase 4 alcanzó su capacidad máxima (20). Puede ingresar a la lista de espera.',
    ],
    ['Penalidad por cancelación tardía (RF-07).', 'Penalidad por cancelación tardía.'],
    ['Ingresos sin egreso en la sede, en este momento (RN-01/RF-05).', 'Ingresos sin egreso en la sede, en este momento.'],
  ])('%s', (entrada, esperado) => {
    expect(sinCodigosDeRequisito(entrada)).toBe(esperado)
  })
})

describe('sinCodigosDeRequisito: formas de la referencia', () => {
  it.each([
    ['Aforo completo (RF-05)', 'Aforo completo'],
    ['Aforo completo [RF-05]', 'Aforo completo'],
    ['Sede nueva (RNF-04)', 'Sede nueva'],
    ['Alta de clase (CU-03)', 'Alta de clase'],
    ['Reserva de cancha (RF-12)', 'Reserva de cancha'],
    ['Acceso duplicado (RN-01, RN-02)', 'Acceso duplicado'],
    ['Acceso duplicado (RN-01 y RN-02)', 'Acceso duplicado'],
    ['Acceso duplicado (RN-01; RF-05)', 'Acceso duplicado'],
    ['Acceso duplicado [RN-01, RF-05, RNF-01]', 'Acceso duplicado'],
    ['Acceso duplicado ( RN-01 )', 'Acceso duplicado'],
  ])('%s', (entrada, esperado) => {
    expect(sinCodigosDeRequisito(entrada)).toBe(esperado)
  })

  it('saca varias referencias separadas del mismo mensaje', () => {
    expect(sinCodigosDeRequisito('Regla de ingreso (RN-01) y de aforo (RF-05) incumplidas.')).toBe('Regla de ingreso y de aforo incumplidas.')
  })

  it('una referencia al principio no deja un espacio de más', () => {
    expect(sinCodigosDeRequisito('(RN-01) El socio ya está dentro.')).toBe('El socio ya está dentro.')
  })

  it('no deja espacios dobles ni puntuación suelta', () => {
    for (const entrada of [
      'A (RN-01) B',
      'A (RN-01), B',
      'A (RN-01) (RF-05) B',
      'A (RN-01) . B',
      'A. (RN-01) B',
      'A (RN-01)',
    ]) {
      const salida = sinCodigosDeRequisito(entrada)
      expect(salida).not.toMatch(/\s{2,}/)
      expect(salida).not.toMatch(/\s[.,;:]/)
      expect(salida).not.toMatch(/^\s|\s$/)
    }
    expect(sinCodigosDeRequisito('A (RN-01), B')).toBe('A, B')
    expect(sinCodigosDeRequisito('A (RN-01) B')).toBe('A B')
  })
})

describe('sinCodigosDeRequisito: lo que no se toca', () => {
  it.each([
    'No pasa nada.',
    '',
    'La sede 3 alcanzó su aforo máximo (50 personas).',
    'Datos inválidos: nombre must be a string',
    // Una mención sin paréntesis no es una referencia.
    'RN-01: un segundo ingreso abierto del mismo socio',
    // Una referencia mezclada con otro texto no es solo un código.
    'Código TOTP de 6 dígitos (RF-04, QR dinámico).',
    // Paréntesis sin cerrar.
    'Texto (RN-01 sin cerrar',
    // Códigos que no son de requisitos.
    'Error (HTTP-500)',
    'Ver (rn-01)',
  ])('"%s" queda igual', (texto) => {
    expect(sinCodigosDeRequisito(texto)).toBe(texto)
  })

  it('es idempotente', () => {
    const una = sinCodigosDeRequisito('Ya tiene un ingreso (RN-01) y no hay lugar (RF-05).')

    expect(sinCodigosDeRequisito(una)).toBe(una)
  })
})
