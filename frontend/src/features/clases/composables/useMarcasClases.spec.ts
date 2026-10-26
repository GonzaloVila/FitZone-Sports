import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  listarReservas: vi.fn(),
  listarEsperas: vi.fn(),
  socioId: { value: 1 as number | null },
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ clases: { listarReservas: mocks.listarReservas, listarEsperas: mocks.listarEsperas } }),
}))

vi.mock('@/features/sesion/composables/useUsuarioSesion', () => ({
  useUsuarioSesion: () => ({ socioId: mocks.socioId }),
}))

import { useMarcasClases } from './useMarcasClases'

const lista = (...items: unknown[]) => ({ items, total: items.length })

function armar(esSocio: boolean, clases = [{ id: 7 }, { id: 8 }, { id: 9 }]) {
  const scope = effectScope()
  const estado = scope.run(() => useMarcasClases(ref(clases), esSocio))!
  return { ...estado, detener: () => scope.stop() }
}

describe('useMarcasClases', () => {
  beforeEach(() => {
    mocks.listarReservas.mockReset().mockResolvedValue(lista())
    mocks.listarEsperas.mockReset().mockResolvedValue(lista())
    mocks.socioId.value = 1
  })

  it('el socio hace una consulta de reservas confirmadas y otra de esperas, y marca las clases', async () => {
    mocks.listarReservas.mockResolvedValue(lista({ id: 1, claseId: 7, socioId: 1, estado: 'CONFIRMADA' }))
    mocks.listarEsperas.mockResolvedValue(
      lista({ id: 2, claseId: 8, socioId: 1, estado: 'EN_ESPERA' }, { id: 3, claseId: 9, socioId: 1, estado: 'CANCELADO' }),
    )

    const { marcas, detener } = armar(true)
    await vi.waitFor(() => expect(marcas.value.size).toBe(2))

    expect(mocks.listarReservas).toHaveBeenCalledTimes(1)
    expect(mocks.listarReservas.mock.calls[0]?.[0]).toEqual({ socioId: 1, estado: 'CONFIRMADA' })
    expect(mocks.listarEsperas).toHaveBeenCalledTimes(1)
    expect(marcas.value.get(7)).toBe('reservada')
    expect(marcas.value.get(8)).toBe('en-espera')
    expect(marcas.value.has(9)).toBe(false)
    detener()
  })

  it('una reserva confirmada que el listado repite junto a una cancelada marca solo la vigente', async () => {
    mocks.listarReservas.mockResolvedValue(
      lista(
        { id: 1, claseId: 7, socioId: 1, estado: 'CANCELADA' },
        { id: 2, claseId: 7, socioId: 1, estado: 'CONFIRMADA' },
      ),
    )

    const { marcas, detener } = armar(true)
    await vi.waitFor(() => expect(marcas.value.size).toBe(1))

    expect(marcas.value.get(7)).toBe('reservada')
    detener()
  })

  it('el personal no hace ninguna consulta ni tiene marcas', async () => {
    const { marcas, recargar, detener } = armar(false)
    await recargar()

    expect(mocks.listarReservas).not.toHaveBeenCalled()
    expect(mocks.listarEsperas).not.toHaveBeenCalled()
    expect(marcas.value.size).toBe(0)
    detener()
  })

  it('un usuario sin socio asociado no consulta', async () => {
    mocks.socioId.value = null

    armar(true).detener()

    expect(mocks.listarReservas).not.toHaveBeenCalled()
  })

  it('recargar vuelve a consultar y deja las marcas al día (por ejemplo, tras cancelar)', async () => {
    mocks.listarReservas.mockResolvedValue(lista({ id: 1, claseId: 7, socioId: 1, estado: 'CONFIRMADA' }))
    const { marcas, recargar, detener } = armar(true)
    await vi.waitFor(() => expect(marcas.value.get(7)).toBe('reservada'))

    mocks.listarReservas.mockResolvedValue(lista())
    await recargar()

    expect(marcas.value.size).toBe(0)
    detener()
  })

  it('si la consulta falla no rompe: la agenda queda sin marcas', async () => {
    mocks.listarReservas.mockRejectedValue(new Error('sin conexión'))

    const { marcas, recargar, detener } = armar(true)
    await recargar()

    expect(marcas.value.size).toBe(0)
    detener()
  })
})
