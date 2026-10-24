import { describe, expect, it } from 'vitest'

import { rutasCanchas } from './rutas'

function rolesDe(nombre: string): readonly string[] {
  const ruta = rutasCanchas.find((candidata) => candidata.name === nombre)
  return ruta?.meta?.roles ?? []
}

describe('rutas de canchas', () => {
  it('el EXTERNO puede ver canchas, reservar un turno y ver sus reservas', () => {
    for (const nombre of ['canchas', 'cancha-turnos', 'mis-reservas']) {
      expect(rolesDe(nombre)).toContain('EXTERNO')
    }
  })

  it('la gestión de canchas sigue siendo solo del GERENTE', () => {
    expect(rolesDe('canchas-gestion')).toEqual(['GERENTE'])
  })
})
