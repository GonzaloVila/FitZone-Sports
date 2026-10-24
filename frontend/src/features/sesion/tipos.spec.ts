import { describe, expect, it } from 'vitest'

import { usuarioDesdeSesion, type SesionIniciada } from './tipos'

function sesion(cambios: Partial<SesionIniciada> = {}): SesionIniciada {
  return {
    accessToken: 'token',
    tokenType: 'Bearer',
    expiresIn: 900,
    rol: 'SOCIO',
    usuarioId: 7,
    ...cambios,
  }
}

describe('usuarioDesdeSesion', () => {
  it('conserva usuarioId, socioId y sedeId que manda el contrato', () => {
    expect(usuarioDesdeSesion(sesion({ usuarioId: 7, socioId: 12 }))).toEqual({
      rol: 'SOCIO',
      usuarioId: 7,
      sedeId: undefined,
      socioId: 12,
    })
    expect(usuarioDesdeSesion(sesion({ rol: 'RECEPCION', usuarioId: 3, sedeId: 5 }))).toMatchObject({
      rol: 'RECEPCION',
      usuarioId: 3,
      sedeId: 5,
    })
  })

  it('un rol desconocido queda como null (sin permisos)', () => {
    expect(usuarioDesdeSesion(sesion({ rol: 'DESCONOCIDO' })).rol).toBeNull()
  })
})
