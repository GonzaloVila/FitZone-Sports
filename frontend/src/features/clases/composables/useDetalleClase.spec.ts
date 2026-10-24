import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  obtener: vi.fn(),
  listarReservas: vi.fn(),
  listarEsperas: vi.fn(),
  cancelarReserva: vi.fn(),
  listarPagos: vi.fn(),
  descargarComprobante: vi.fn(),
  rol: { value: 'SOCIO' as string | null },
  socioId: { value: 1 as number | null },
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({
    clases: {
      obtener: mocks.obtener,
      listarReservas: mocks.listarReservas,
      listarEsperas: mocks.listarEsperas,
      cancelarReserva: mocks.cancelarReserva,
      reservar: vi.fn(),
      listarEsperaDeClase: vi.fn(),
      listarInscriptos: vi.fn(),
      anotarseEnEspera: vi.fn(),
      confirmarEspera: vi.fn(),
      salirDeEspera: vi.fn(),
    },
    pagos: { listar: mocks.listarPagos, descargarComprobante: mocks.descargarComprobante },
  }),
}))

vi.mock('@/features/sesion/composables/useUsuarioSesion', () => ({
  useUsuarioSesion: () => ({ rol: mocks.rol, socioId: mocks.socioId }),
}))

import { useDetalleClase } from './useDetalleClase'

const CLASE = {
  id: 7,
  sedeId: 1,
  tipo: 'Spinning',
  instructor: 'Lucía Ferreyra',
  horarioInicio: '2026-10-24T18:00:00-03:00',
  horarioFin: '2026-10-24T19:00:00-03:00',
  capacidad: 10,
  reservasConfirmadas: 1,
  cupoDisponible: 9,
}

async function armar(id = ref(7)) {
  const scope = effectScope()
  const estado = scope.run(() => useDetalleClase(() => id.value))!
  await vi.waitFor(() => expect(mocks.listarReservas).toHaveBeenCalled())
  return { ...estado, id, detener: () => scope.stop() }
}

describe('useDetalleClase: reserva cancelada en esta pantalla', () => {
  beforeEach(() => {
    mocks.obtener.mockReset().mockResolvedValue(CLASE)
    mocks.listarReservas
      .mockReset()
      .mockResolvedValue({ items: [{ id: 5, claseId: 7, socioId: 1, estado: 'CONFIRMADA' }], total: 1 })
    mocks.listarEsperas.mockReset().mockResolvedValue({ items: [], total: 0 })
    mocks.cancelarReserva.mockReset().mockResolvedValue(undefined)
    mocks.listarPagos.mockReset().mockResolvedValue({ items: [], total: 0 })
    mocks.rol.value = 'SOCIO'
    mocks.socioId.value = 1
  })

  it('marca reservaCancelada al cancelar y la resetea al cambiar de clase', async () => {
    const { cancelarReserva, reservaCancelada, id, detener } = await armar()

    expect(await cancelarReserva()).toBe(true)
    expect(reservaCancelada.value).toBe(true)

    id.value = 8
    await nextTick()
    expect(reservaCancelada.value).toBe(false)
    detener()
  })
})
