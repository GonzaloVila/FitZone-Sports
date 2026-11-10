import { describe, expect, it } from 'vitest'
import { rolPermitido, rutaInicialPorRol } from './acceso'
import type { Rol } from './tipos'

// Autenticación y roles (Unidad III): cada rol entra a su pantalla inicial y solo a las rutas que su rol permite. El guard del router se apoya en
// estas dos funciones para no caer en bucles de redirección.
describe('rutaInicialPorRol', () => {
  it.each([
    ['RECEPCION', '/socios'],
    ['GERENTE', '/socios'],
    ['SOCIO', '/carnet'],
    ['EXTERNO', '/canchas'],
  ] as const)('%s entra a %s', (rol, ruta) => {
    expect(rutaInicialPorRol(rol)).toBe(ruta)
  })

  it('un rol desconocido (null) va a /inicio, que solo pide sesión', () => {
    expect(rutaInicialPorRol(null)).toBe('/inicio')
  })
})

describe('rolPermitido', () => {
  const SOLO_PERSONAL: Rol[] = ['RECEPCION', 'GERENTE']

  it('una ruta sin roles solo pide sesión: cualquier rol, incluso el desconocido, entra', () => {
    expect(rolPermitido(undefined, 'SOCIO')).toBe(true)
    expect(rolPermitido(undefined, null)).toBe(true)
  })

  it('con roles, entra solo un rol de la lista', () => {
    expect(rolPermitido(SOLO_PERSONAL, 'GERENTE')).toBe(true)
    expect(rolPermitido(SOLO_PERSONAL, 'RECEPCION')).toBe(true)
    expect(rolPermitido(SOLO_PERSONAL, 'SOCIO')).toBe(false)
    expect(rolPermitido(SOLO_PERSONAL, 'EXTERNO')).toBe(false)
  })

  it('un rol desconocido nunca cumple una restricción', () => {
    expect(rolPermitido(SOLO_PERSONAL, null)).toBe(false)
  })

  it('una lista vacía no deja entrar a nadie', () => {
    expect(rolPermitido([], 'GERENTE')).toBe(false)
  })
})
