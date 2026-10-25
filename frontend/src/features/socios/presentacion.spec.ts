import { describe, expect, it } from 'vitest'

import { accionPermitida, esAccionConModal, esAccionFila } from './presentacion'

describe('accionPermitida', () => {
  it('suspender solo desde ACTIVA', () => {
    expect(accionPermitida('suspender', 'ACTIVA')).toBe(true)
    expect(accionPermitida('suspender', 'SUSPENDIDA')).toBe(false)
    expect(accionPermitida('suspender', 'VENCIDA')).toBe(false)
    expect(accionPermitida('suspender', null)).toBe(false)
  })

  it('reactivar solo desde SUSPENDIDA', () => {
    expect(accionPermitida('reactivar', 'SUSPENDIDA')).toBe(true)
    expect(accionPermitida('reactivar', 'ACTIVA')).toBe(false)
    expect(accionPermitida('reactivar', 'VENCIDA')).toBe(false)
    expect(accionPermitida('reactivar', null)).toBe(false)
  })

  it('cambiar plan y renovación automática piden una membresía disponible, en cualquier estado', () => {
    for (const estado of ['ACTIVA', 'SUSPENDIDA', 'VENCIDA'] as const) {
      expect(accionPermitida('cambiar-plan', estado)).toBe(true)
      expect(accionPermitida('renovacion-automatica', estado)).toBe(true)
    }
    expect(accionPermitida('cambiar-plan', null)).toBe(false)
    expect(accionPermitida('renovacion-automatica', null)).toBe(false)
  })

  it('dejar de ser socio y cambiar sede no dependen de la membresía', () => {
    expect(accionPermitida('dejar-de-ser-socio', null)).toBe(true)
    expect(accionPermitida('dejar-de-ser-socio', 'VENCIDA')).toBe(true)
    expect(accionPermitida('cambiar-sede', null)).toBe(true)
  })
})

describe('acciones que pide la lista', () => {
  it('solo cuatro abren modal desde la ficha', () => {
    expect(['cambiar-plan', 'suspender', 'reactivar', 'dejar-de-ser-socio'].every(esAccionConModal)).toBe(true)
    expect(esAccionConModal('cambiar-sede')).toBe(false)
    expect(esAccionConModal('renovacion-automatica')).toBe(false)
    expect(esAccionConModal('ver-ficha')).toBe(false)
    expect(esAccionConModal(undefined)).toBe(false)
    expect(esAccionConModal(['suspender'])).toBe(false)
  })

  it('una acción de fila es "ver-ficha" o una con modal', () => {
    expect(esAccionFila('ver-ficha')).toBe(true)
    expect(esAccionFila('suspender')).toBe(true)
    expect(esAccionFila('exportar')).toBe(false)
  })
})
