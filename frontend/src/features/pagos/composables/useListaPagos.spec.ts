import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

const mocks = vi.hoisted(() => ({ listar: vi.fn() }))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ pagos: { listar: mocks.listar } }),
}))

import { useListaPagos } from './useListaPagos'

async function armar() {
  const scope = effectScope()
  const estado = scope.run(() => useListaPagos())!
  await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalled())
  return { ...estado, detener: () => scope.stop() }
}

describe('useListaPagos', () => {
  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue({ items: [], total: 0 })
  })

  it('sin estado no manda filtro, así el contrato devuelve los aprobados', async () => {
    const { detener } = await armar()

    expect(mocks.listar).toHaveBeenCalledWith(
      { estado: undefined, tipo: undefined, desde: undefined, hasta: undefined },
      1,
      10,
      expect.any(AbortSignal),
    )
    detener()
  })

  it('manda el estado elegido y vuelve a la página 1', async () => {
    const { filtros, pagina, detener } = await armar()
    pagina.value = 2
    await nextTick()
    mocks.listar.mockClear()

    filtros.estado = 'RECHAZADO'
    await nextTick()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalled())

    expect(pagina.value).toBe(1)
    expect(mocks.listar.mock.calls[0]?.[0]).toMatchObject({ estado: 'RECHAZADO' })
    detener()
  })

  it('con desde posterior a hasta no consulta y marca el filtro inválido', async () => {
    const { filtros, filtroInvalido, detener } = await armar()
    mocks.listar.mockClear()

    filtros.desde = '2026-10-10'
    filtros.hasta = '2026-10-01'
    await nextTick()

    expect(filtroInvalido.value).toBe(true)
    expect(mocks.listar).not.toHaveBeenCalled()
    detener()
  })
})
