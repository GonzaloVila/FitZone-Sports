import { describe, expect, it } from 'vitest'

import { rutasCanchas } from './rutas'

function rutaDe(nombre: string) {
  return rutasCanchas.find((candidata) => candidata.name === nombre)
}

function rolesDe(nombre: string): readonly string[] {
  return rutaDe(nombre)?.meta?.roles ?? []
}

describe('rutas de canchas', () => {
  it('el EXTERNO puede ver canchas y reservar un turno', () => {
    for (const nombre of ['canchas', 'cancha-turnos']) {
      expect(rolesDe(nombre)).toContain('EXTERNO')
    }
  })

  it('la gestión de canchas sigue siendo solo del GERENTE', () => {
    expect(rolesDe('canchas-gestion')).toEqual(['GERENTE'])
  })

  it('/mis-reservas redirige a la vista de /canchas, es solo del SOCIO y el EXTERNO y no tiene ítem de menú', () => {
    const ruta = rutaDe('mis-reservas')

    expect(ruta?.redirect).toEqual({ name: 'canchas', query: { vista: 'mis-reservas' } })
    expect(rolesDe('mis-reservas')).toEqual(['SOCIO', 'EXTERNO'])
    expect(ruta?.meta?.navegacion).toBeUndefined()
  })
})
