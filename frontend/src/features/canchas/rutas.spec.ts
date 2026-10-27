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

  it('/canchas/gestion redirige a /canchas (la gestión es parte de la pantalla) y ya no es una ruta propia', () => {
    const ruta = rutasCanchas.find((candidata) => candidata.path === '/canchas/gestion')

    expect(ruta?.redirect).toEqual({ name: 'canchas' })
    expect(ruta?.component).toBeUndefined()
    expect(ruta?.name).toBeUndefined()
    expect(rutaDe('canchas-gestion')).toBeUndefined()
  })

  it('/mis-reservas redirige a la vista de /canchas, es solo del SOCIO y el EXTERNO y no tiene ítem de menú', () => {
    const ruta = rutaDe('mis-reservas')

    expect(ruta?.redirect).toEqual({ name: 'canchas', query: { vista: 'mis-reservas' } })
    expect(rolesDe('mis-reservas')).toEqual(['SOCIO', 'EXTERNO'])
    expect(ruta?.meta?.navegacion).toBeUndefined()
  })
})
