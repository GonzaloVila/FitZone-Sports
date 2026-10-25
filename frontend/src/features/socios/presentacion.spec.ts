import { describe, expect, it } from 'vitest'

import { ErrorApi } from '@/compartido/http/errores'
import {
  MENSAJE_COBRO_RECHAZADO,
  accionPermitida,
  cambiosParaPlan,
  esAccionFila,
  mensajeDeErrorDeMembresia,
  periodoTerminado,
  puedeConfirmarPlan,
  textoVigencia,
} from './presentacion'
import type { EstadoMembresia } from './services/servicioSocios'

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

  it.each([
    ['ACTIVA', true],
    ['VENCIDA', true],
    ['SUSPENDIDA', false],
    [null, false],
  ] as const)('cambiar plan con la membresía %s: %s', (estado, esperado) => {
    expect(accionPermitida('cambiar-plan', estado)).toBe(esperado)
  })

  it('la renovación automática pide una membresía disponible, en cualquier estado', () => {
    for (const estado of ['ACTIVA', 'SUSPENDIDA', 'VENCIDA'] as const) expect(accionPermitida('renovacion-automatica', estado)).toBe(true)
    expect(accionPermitida('renovacion-automatica', null)).toBe(false)
  })

  it('dejar de ser socio y cambiar sede no dependen de la membresía', () => {
    expect(accionPermitida('dejar-de-ser-socio', null)).toBe(true)
    expect(accionPermitida('dejar-de-ser-socio', 'VENCIDA')).toBe(true)
    expect(accionPermitida('cambiar-sede', null)).toBe(true)
  })
})

describe('cambiosParaPlan', () => {
  it.each([
    ['ACTIVA', 'ANUAL', { plan: 'ANUAL' }],
    ['VENCIDA', 'ANUAL', { plan: 'ANUAL', estado: 'ACTIVA' }],
    ['VENCIDA', 'MENSUAL', { plan: 'MENSUAL', estado: 'ACTIVA' }],
    ['SUSPENDIDA', 'MENSUAL', { plan: 'MENSUAL' }],
    [null, 'TRIMESTRAL', { plan: 'TRIMESTRAL' }],
  ] as const)('con la membresía %s y el plan %s manda %j', (estado, plan, esperado) => {
    expect(cambiosParaPlan(plan, estado)).toEqual(esperado)
  })
})

describe('puedeConfirmarPlan', () => {
  // [estado, plan actual, plan elegido, esperado]
  it.each([
    ['ACTIVA', 'MENSUAL', 'MENSUAL', false],
    ['ACTIVA', 'MENSUAL', 'ANUAL', true],
    ['ACTIVA', 'ANUAL', 'MENSUAL', true],
    ['VENCIDA', 'MENSUAL', 'MENSUAL', true],
    ['VENCIDA', 'MENSUAL', 'TRIMESTRAL', true],
    ['SUSPENDIDA', 'MENSUAL', 'ANUAL', false],
    [null, null, 'ANUAL', false],
    ['ACTIVA', 'MENSUAL', '', false],
    ['VENCIDA', 'MENSUAL', 'DIARIO', false],
  ] as [EstadoMembresia | null, 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL' | null, string, boolean][])(
    'estado %s, plan actual %s, elegido "%s": %s',
    (estado, actual, elegido, esperado) => {
      expect(puedeConfirmarPlan(estado, actual, elegido)).toBe(esperado)
    },
  )
})

describe('vigencia', () => {
  const ahora = new Date('2026-06-15T12:00:00-03:00')

  it('periodoTerminado compara el fin con el momento dado', () => {
    expect(periodoTerminado('2026-06-14T00:00:00-03:00', ahora)).toBe(true)
    expect(periodoTerminado('2026-06-16T00:00:00-03:00', ahora)).toBe(false)
  })

  it('textoVigencia distingue vigente, no vigente y vencida', () => {
    expect(textoVigencia({ estado: 'ACTIVA', fechaFin: '2026-07-01T00:00:00-03:00' }, ahora)).toBe('Vigente hasta 01/07/2026')
    expect(textoVigencia({ estado: 'SUSPENDIDA', fechaFin: '2026-07-01T00:00:00-03:00' }, ahora)).toBe('Período hasta 01/07/2026')
    expect(textoVigencia({ estado: 'VENCIDA', fechaFin: '2026-06-01T00:00:00-03:00' }, ahora)).toBe('Venció el 01/06/2026')
    expect(textoVigencia({ estado: 'ACTIVA', fechaFin: '2026-06-01T00:00:00-03:00' }, ahora)).toBe('Venció el 01/06/2026')
  })
})

describe('mensajeDeErrorDeMembresia', () => {
  it('el 402 es el cobro rechazado, con un texto claro', () => {
    expect(mensajeDeErrorDeMembresia(new ErrorApi(402, 'Payment Required'), 'x')).toBe(MENSAJE_COBRO_RECHAZADO)
    expect(MENSAJE_COBRO_RECHAZADO).toBe('El cobro fue rechazado, no se hicieron cambios.')
  })

  it('otros errores del servidor usan su mensaje, y los demás el texto por defecto', () => {
    expect(mensajeDeErrorDeMembresia(new ErrorApi(409, 'Conflicto de estado.'), 'x')).toBe('Conflicto de estado.')
    expect(mensajeDeErrorDeMembresia(new TypeError('red'), 'No se pudo.')).toBe('No se pudo.')
  })
})

describe('acciones que se piden desde el menú de una fila', () => {
  it('son ver la ficha y las cuatro con modal', () => {
    for (const accion of ['ver-ficha', 'cambiar-plan', 'suspender', 'reactivar', 'dejar-de-ser-socio']) expect(esAccionFila(accion)).toBe(true)
    expect(esAccionFila('cambiar-sede')).toBe(false)
    expect(esAccionFila('renovacion-automatica')).toBe(false)
    expect(esAccionFila('exportar')).toBe(false)
    expect(esAccionFila(undefined)).toBe(false)
  })
})
