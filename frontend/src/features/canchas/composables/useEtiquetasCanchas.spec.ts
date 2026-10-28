import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

const mocks = vi.hoisted(() => ({ buscar: vi.fn() }))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ canchas: { buscar: mocks.buscar } }),
}))

import { useEtiquetasCanchas } from './useEtiquetasCanchas'

function armar() {
  const scope = effectScope()
  const estado = scope.run(() => useEtiquetasCanchas())!
  return { ...estado, detener: () => scope.stop() }
}

describe('useEtiquetasCanchas', () => {
  beforeEach(() => {
    mocks.buscar.mockReset()
  })

  it('hace una sola consulta (todas las sedes, sin filtros, 100 por página) y nombra y ubica las canchas', async () => {
    mocks.buscar.mockResolvedValue({
      items: [
        { id: 2, tipo: 'FUTBOL5', sedeId: 1 },
        { id: 5, tipo: 'PADDLE', sedeId: 4 },
      ],
      total: 2,
    })
    const { etiquetaDe, sedeIdDe, detener } = armar()

    await vi.waitFor(() => expect(etiquetaDe(2)).toBe('Fútbol 5 #2'))

    expect(etiquetaDe(5)).toBe('Paddle #5')
    expect(sedeIdDe(5)).toBe(4)
    expect(mocks.buscar).toHaveBeenCalledTimes(1)
    expect(mocks.buscar).toHaveBeenCalledWith({}, 1, 100, expect.anything())
    detener()
  })

  it('una cancha que no aparece cae a "Cancha #N" y no tiene sede', async () => {
    mocks.buscar.mockResolvedValue({ items: [{ id: 2, tipo: 'FUTBOL5', sedeId: 1 }], total: 1 })
    const { etiquetaDe, sedeIdDe, detener } = armar()

    await vi.waitFor(() => expect(etiquetaDe(2)).toBe('Fútbol 5 #2'))

    expect(etiquetaDe(9)).toBe('Cancha #9')
    expect(sedeIdDe(9)).toBeNull()
    detener()
  })

  it('si la consulta falla todas caen a "Cancha #N"', async () => {
    mocks.buscar.mockRejectedValue(new Error('sin conexión'))
    const { etiquetaDe, sedeIdDe, detener } = armar()

    await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

    expect(etiquetaDe(2)).toBe('Cancha #2')
    expect(sedeIdDe(2)).toBeNull()
    detener()
  })

  it('al detenerse aborta la consulta en curso', async () => {
    mocks.buscar.mockResolvedValue({ items: [], total: 0 })
    const { detener } = armar()
    const senal = mocks.buscar.mock.calls[0]?.[3] as AbortSignal

    detener()

    expect(senal.aborted).toBe(true)
  })
})
