import { describe, expect, it } from 'vitest'

import { accionesDeMenuSocio, avisoDeMembresia, esAccionFicha, filaDeSocio } from './presentacion'
import type { EstadoMembresia, Membresia, Socio } from './services/servicioSocios'

const membresia = (estado: EstadoMembresia): Membresia => ({
  id: 1,
  plan: 'MENSUAL',
  estado,
  fechaInicio: '2026-01-15T00:00:00-03:00',
  fechaFin: '2026-02-15T00:00:00-03:00',
  renuevaAutomatica: false,
})

const socio: Socio = {
  id: 7,
  usuarioId: 107,
  sedeOrigenId: 2,
  fechaAlta: '2026-01-15T10:00:00-03:00',
  nombre: 'Camila Domínguez',
  email: 'camila@fitzone.com',
}

describe('avisoDeMembresia', () => {
  it('una membresía ACTIVA no lleva aviso', () => {
    expect(avisoDeMembresia(membresia('ACTIVA'))).toBeNull()
  })

  it('VENCIDA: tono peligro, la fecha de fin formateada y el botón Renovar (cambiar plan) en variante primaria', () => {
    expect(avisoDeMembresia(membresia('VENCIDA'))).toEqual({
      tono: 'peligro',
      texto: 'La membresía venció el 15/02/2026.',
      accion: { clave: 'cambiar-plan', etiqueta: 'Renovar', variante: 'primario' },
    })
  })

  it('SUSPENDIDA: tono advertencia y el botón Reactivar en variante advertencia', () => {
    expect(avisoDeMembresia(membresia('SUSPENDIDA'))).toEqual({
      tono: 'advertencia',
      texto: 'La membresía está suspendida.',
      accion: { clave: 'reactivar', etiqueta: 'Reactivar', variante: 'advertencia' },
    })
  })
})

describe('accionesDeMenuSocio', () => {
  const resumen = (estado: EstadoMembresia | null, contexto: 'lista' | 'ficha') =>
    accionesDeMenuSocio(estado, contexto).map((accion) => [accion.etiqueta, Boolean(accion.deshabilitada)])

  it('lista: Ver ficha, plan, suspender o reactivar y baja, sin separadores', () => {
    const acciones = accionesDeMenuSocio('ACTIVA', 'lista')

    expect(acciones.map((accion) => accion.clave)).toEqual(['ver-ficha', 'cambiar-plan', 'suspender', 'dejar-de-ser-socio'])
    expect(acciones.some((accion) => accion.separada)).toBe(false)
    expect(acciones.at(-1)?.peligro).toBe(true)
  })

  it('ficha: sin Ver ficha, con Cambiar sede de origen, y la baja al final, separada y en peligro', () => {
    const acciones = accionesDeMenuSocio('ACTIVA', 'ficha')

    expect(acciones.map((accion) => accion.clave)).toEqual(['cambiar-plan', 'suspender', 'cambiar-sede', 'dejar-de-ser-socio'])
    expect(acciones.filter((accion) => accion.separada).map((accion) => accion.clave)).toEqual(['dejar-de-ser-socio'])
    expect(acciones.at(-1)?.peligro).toBe(true)
  })

  it.each(['lista', 'ficha'] as const)('%s: las reglas de habilitación son las mismas', (contexto) => {
    expect(resumen('ACTIVA', contexto).filter(([, deshabilitada]) => deshabilitada)).toEqual([])
    expect(resumen('SUSPENDIDA', contexto)).toContainEqual(['Cambiar plan', true])
    expect(resumen('SUSPENDIDA', contexto)).toContainEqual(['Reactivar', false])
    expect(resumen('VENCIDA', contexto)).toContainEqual(['Renovar', false])
    expect(resumen('VENCIDA', contexto)).toContainEqual(['Suspender', true])
    expect(resumen(null, contexto).filter(([, deshabilitada]) => deshabilitada).map(([etiqueta]) => etiqueta)).toEqual([
      'Cambiar plan',
      'Suspender',
    ])
  })

  it('cambiar sede y dejar de ser socio nunca se deshabilitan, ni sin membresía', () => {
    const acciones = accionesDeMenuSocio(null, 'ficha')

    expect(acciones.find((accion) => accion.clave === 'cambiar-sede')?.deshabilitada).toBeUndefined()
    expect(acciones.find((accion) => accion.clave === 'dejar-de-ser-socio')?.deshabilitada).toBeUndefined()
  })
})

describe('esAccionFicha', () => {
  it('acepta las acciones del menú de la ficha y rechaza el resto', () => {
    for (const clave of ['cambiar-plan', 'suspender', 'reactivar', 'cambiar-sede', 'dejar-de-ser-socio']) expect(esAccionFicha(clave)).toBe(true)
    expect(esAccionFicha('ver-ficha')).toBe(false)
    expect(esAccionFicha('renovacion-automatica')).toBe(false)
    expect(esAccionFicha(undefined)).toBe(false)
  })
})

describe('filaDeSocio', () => {
  it('arma la fila con la membresía disponible', () => {
    expect(filaDeSocio(socio, { situacion: 'disponible', valor: membresia('ACTIVA') })).toEqual({
      socio,
      membresia: { situacion: 'disponible', membresia: membresia('ACTIVA') },
    })
  })

  it.each(['cargando', 'no-disponible'] as const)('conserva la situación %s', (situacion) => {
    expect(filaDeSocio(socio, { situacion })).toEqual({ socio, membresia: { situacion } })
  })
})
