import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

const mocks = vi.hoisted(() => ({
  listarReservas: vi.fn(),
  listarEsperas: vi.fn(),
  obtener: vi.fn(),
  cancelarReserva: vi.fn(),
  listarPagos: vi.fn(),
  descargarComprobante: vi.fn(),
  socioId: { value: 1 as number | null },
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({
    clases: {
      listarReservas: mocks.listarReservas,
      listarEsperas: mocks.listarEsperas,
      obtener: mocks.obtener,
      cancelarReserva: mocks.cancelarReserva,
    },
    pagos: { listar: mocks.listarPagos, descargarComprobante: mocks.descargarComprobante },
  }),
}))

vi.mock('@/features/sesion/composables/useUsuarioSesion', () => ({
  useUsuarioSesion: () => ({ socioId: mocks.socioId }),
}))

import { useMisClases } from './useMisClases'

async function armar() {
  const scope = effectScope()
  const estado = scope.run(() => useMisClases())!
  await vi.waitFor(() => expect(mocks.listarReservas).toHaveBeenCalled())
  return { ...estado, detener: () => scope.stop() }
}

describe('useMisClases: cancelación con penalidad (RF-07)', () => {
  beforeEach(() => {
    mocks.listarReservas.mockReset().mockResolvedValue({ items: [], total: 0 })
    mocks.listarEsperas.mockReset().mockResolvedValue({ items: [], total: 0 })
    mocks.obtener.mockReset()
    mocks.cancelarReserva.mockReset().mockResolvedValue(undefined)
    mocks.listarPagos.mockReset()
    mocks.socioId.value = 1
  })

  it('busca el pago de la reserva y muestra el importe de la penalidad', async () => {
    mocks.listarPagos.mockResolvedValue({ items: [{ id: 99, monto: 5000, estado: 'APROBADO' }], total: 1 })
    const { cancelarReserva, pagoPenalidad, exitoAccion, detener } = await armar()

    const ok = await cancelarReserva(7)

    expect(ok).toBe(true)
    expect(mocks.listarPagos).toHaveBeenCalledWith({ reservaClaseId: 7 }, 1, 1)
    expect(pagoPenalidad.value?.id).toBe(99)
    expect(exitoAccion.value).toMatch(/penalidad/i)
    detener()
  })

  it('si no hubo cobro deja el mensaje simple', async () => {
    mocks.listarPagos.mockResolvedValue({ items: [], total: 0 })
    const { cancelarReserva, pagoPenalidad, exitoAccion, detener } = await armar()

    const ok = await cancelarReserva(7)

    expect(ok).toBe(true)
    expect(pagoPenalidad.value).toBeNull()
    expect(exitoAccion.value).toBe('Reserva cancelada.')
    detener()
  })
})
