import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

const mocks = vi.hoisted(() => ({ listar: vi.fn(), modificar: vi.fn() }))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ canchas: { listar: mocks.listar, modificar: mocks.modificar } }),
}))

import { ErrorApi } from '@/compartido/http/errores'
import type { Cancha } from '../services/servicioCanchas'
import { useGestionCanchas } from './useGestionCanchas'

const cancha = (cambios: Partial<Cancha> = {}): Cancha => ({
  id: 1,
  sedeId: 3,
  tipo: 'PADDLE',
  costoPorHora: 5000,
  estado: 'OPERATIVA',
  ...cambios,
})

function armar(sede: number | null = 3) {
  const sedeId = ref<number | null>(sede)
  const estado = effectScope().run(() => useGestionCanchas(sedeId))!
  return { ...estado, sedeId }
}

describe('useGestionCanchas', () => {
  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue({ items: [cancha()], total: 1 })
    mocks.modificar.mockReset().mockResolvedValue(cancha())
  })

  it('trae las canchas de la sede, y vuelve a traerlas al cambiar de sede', async () => {
    const { items, sedeId } = armar(3)
    await vi.waitFor(() => expect(items.value).toHaveLength(1))
    expect(mocks.listar).toHaveBeenCalledWith(3, {}, 1, 100, expect.anything())

    sedeId.value = 4
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))

    expect(mocks.listar).toHaveBeenLastCalledWith(4, {}, 1, 100, expect.anything())
  })

  it('sin sede no consulta', async () => {
    const { items } = armar(null)

    expect(mocks.listar).not.toHaveBeenCalled()
    expect(items.value).toEqual([])
  })

  it('pasar una cancha operativa a mantenimiento la modifica, avisa y recarga', async () => {
    const { alternarMantenimiento, exito } = armar()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    const ok = await alternarMantenimiento(cancha())

    expect(ok).toBe(true)
    expect(mocks.modificar).toHaveBeenCalledWith(1, { estado: 'EN_MANTENIMIENTO' })
    expect(exito.value).toBe('La cancha pasó a mantenimiento.')
    expect(mocks.listar).toHaveBeenCalledTimes(2)
  })

  it('liberar el mantenimiento la vuelve operativa', async () => {
    const { alternarMantenimiento, exito } = armar()

    await alternarMantenimiento(cancha({ estado: 'EN_MANTENIMIENTO' }))

    expect(mocks.modificar).toHaveBeenCalledWith(1, { estado: 'OPERATIVA' })
    expect(exito.value).toBe('La cancha volvió a estar operativa.')
  })

  it('un costo inválido no llama al servidor', async () => {
    const { cambiarCosto, errorAccion } = armar()

    expect(await cambiarCosto(cancha(), -5)).toBe(false)
    expect(await cambiarCosto(cancha(), Number.NaN)).toBe(false)

    expect(mocks.modificar).not.toHaveBeenCalled()
    expect(errorAccion.value).toBe('Ingresá un costo por hora de cero o más.')
  })

  it('un costo válido se envía', async () => {
    const { cambiarCosto, exito } = armar()

    expect(await cambiarCosto(cancha(), 6500)).toBe(true)

    expect(mocks.modificar).toHaveBeenCalledWith(1, { costoPorHora: 6500 })
    expect(exito.value).toBe('Costo por hora actualizado.')
  })

  it('un 422 crudo del servidor se muestra como texto humano', async () => {
    mocks.modificar.mockRejectedValue(
      new ErrorApi(422, 'costoPorHora must be a number', {
        type: 'about:blank',
        title: 'Error',
        status: 422,
        detail: 'costoPorHora must be a number',
      }),
    )
    const { cambiarCosto, errorAccion, guardando } = armar()

    expect(await cambiarCosto(cancha(), 100)).toBe(false)

    expect(errorAccion.value).toBe('Revisá los datos de la cancha e intentá de nuevo.')
    expect(guardando.value).toBe(false)
  })
})
