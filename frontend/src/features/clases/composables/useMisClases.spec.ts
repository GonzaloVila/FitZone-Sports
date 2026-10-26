import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

const mocks = vi.hoisted(() => ({
  listarReservas: vi.fn(),
  listarEsperas: vi.fn(),
  listarEsperaDeClase: vi.fn(),
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
      listarEsperaDeClase: mocks.listarEsperaDeClase,
      obtener: mocks.obtener,
      cancelarReserva: mocks.cancelarReserva,
    },
    pagos: { listar: mocks.listarPagos, descargarComprobante: mocks.descargarComprobante },
  }),
}))

vi.mock('@/features/sesion/composables/useUsuarioSesion', () => ({
  useUsuarioSesion: () => ({ socioId: mocks.socioId }),
}))

import { limpiarPenalidadCobrada, usePenalidadCobrada } from '@/compartido/composables/usePenalidadCobrada'
import { formatearHorario } from '../presentacion'
import { useMisClases } from './useMisClases'

async function armar() {
  const scope = effectScope()
  const estado = scope.run(() => useMisClases())!
  await vi.waitFor(() => expect(mocks.listarReservas).toHaveBeenCalled())
  return { ...estado, detener: () => scope.stop() }
}

describe('useMisClases: cancelación con penalidad (RF-07)', () => {
  beforeEach(() => {
    limpiarPenalidadCobrada()
    mocks.listarReservas.mockReset().mockResolvedValue({ items: [], total: 0 })
    mocks.listarEsperas.mockReset().mockResolvedValue({ items: [], total: 0 })
    mocks.obtener.mockReset()
    mocks.cancelarReserva.mockReset().mockResolvedValue(undefined)
    mocks.listarPagos.mockReset()
    mocks.socioId.value = 1
  })

  it('busca el pago de la reserva y deja el importe como última penalidad cobrada', async () => {
    mocks.listarPagos.mockResolvedValue({ items: [{ id: 99, monto: 5000, estado: 'APROBADO' }], total: 1 })
    const { cancelarReserva, exitoAccion, detener } = await armar()

    const ok = await cancelarReserva(7)

    expect(ok).toBe(true)
    expect(mocks.listarPagos).toHaveBeenCalledWith({ reservaClaseId: 7 }, 1, 1)
    expect(usePenalidadCobrada().penalidad.value).toEqual({ pagoId: 99, monto: 5000, clase: null })
    expect(exitoAccion.value).toBeNull()
    detener()
  })

  it('el aviso recuerda la clase cancelada, tomada de las reservas próximas', async () => {
    const clase = {
      id: 8,
      tipo: 'Yoga',
      horarioInicio: '2026-10-24T18:00:00-03:00',
      horarioFin: '2026-10-24T19:00:00-03:00',
    }
    mocks.listarReservas.mockImplementation(async (filtros: { estado?: string }) =>
      filtros.estado === 'CANCELADA'
        ? { items: [], total: 0 }
        : { items: [{ id: 7, claseId: 8, socioId: 1, estado: 'CONFIRMADA' }], total: 1 },
    )
    mocks.obtener.mockResolvedValue(clase)
    mocks.listarPagos.mockResolvedValue({ items: [{ id: 99, monto: 5000, estado: 'APROBADO' }], total: 1 })
    const { cancelarReserva, proximas, detener } = await armar()
    await vi.waitFor(() => expect(proximas.value).toHaveLength(1))

    await cancelarReserva(7)

    expect(usePenalidadCobrada().penalidad.value).toEqual({
      pagoId: 99,
      monto: 5000,
      clase: { id: 8, tipo: 'Yoga', horario: formatearHorario(clase) },
    })
    detener()
  })

  it('si no hubo cobro deja el mensaje simple', async () => {
    mocks.listarPagos.mockResolvedValue({ items: [], total: 0 })
    const { cancelarReserva, exitoAccion, detener } = await armar()

    const ok = await cancelarReserva(7)

    expect(ok).toBe(true)
    expect(usePenalidadCobrada().penalidad.value).toBeNull()
    expect(exitoAccion.value).toBe('Reserva cancelada.')
    detener()
  })
})

describe('useMisClases: listados', () => {
  beforeEach(() => {
    limpiarPenalidadCobrada()
    mocks.listarReservas.mockReset()
    mocks.listarEsperas.mockReset()
    mocks.listarEsperaDeClase.mockReset().mockResolvedValue({ items: [], total: 0 })
    mocks.obtener.mockReset().mockResolvedValue(null)
    mocks.socioId.value = 1
  })

  it('una reserva cancelada no se repite aunque la consulta sin estado también la traiga', async () => {
    const cancelada = { id: 1, claseId: 7, socioId: 1, estado: 'CANCELADA' }
    const confirmada = { id: 2, claseId: 8, socioId: 1, estado: 'CONFIRMADA' }
    mocks.listarReservas.mockImplementation(async (filtros: { estado?: string }) =>
      filtros.estado === 'CANCELADA'
        ? { items: [cancelada], total: 1 }
        : { items: [cancelada, confirmada], total: 2 },
    )
    mocks.listarEsperas.mockResolvedValue({ items: [], total: 0 })
    const { proximas, pasadas, detener } = await armar()
    await vi.waitFor(() => expect(proximas.value).toHaveLength(1))

    expect(pasadas.value.map((f) => f.reserva.id)).toEqual([1])
    detener()
  })

  it('las esperas canceladas no figuran en la lista de espera', async () => {
    mocks.listarReservas.mockResolvedValue({ items: [], total: 0 })
    mocks.listarEsperas.mockResolvedValue({
      items: [
        { id: 3, claseId: 7, socioId: 1, estado: 'CANCELADO' },
        { id: 4, claseId: 8, socioId: 1, estado: 'EN_ESPERA' },
      ],
      total: 2,
    })
    const { esperas, detener } = await armar()
    await vi.waitFor(() => expect(esperas.value).toHaveLength(1))

    expect(esperas.value[0]?.espera.id).toBe(4)
    detener()
  })

  it('el lugar de una espera se cuenta entre las vigentes de la cola, sin las canceladas', async () => {
    mocks.listarReservas.mockResolvedValue({ items: [], total: 0 })
    mocks.listarEsperas.mockResolvedValue({ items: [{ id: 4, claseId: 8, socioId: 1, estado: 'EN_ESPERA' }], total: 1 })
    mocks.listarEsperaDeClase.mockResolvedValue({
      items: [
        { id: 3, claseId: 8, socioId: 2, estado: 'CANCELADO' },
        { id: 4, claseId: 8, socioId: 1, estado: 'EN_ESPERA' },
      ],
      total: 2,
    })
    const { esperas, detener } = await armar()
    await vi.waitFor(() => expect(esperas.value).toHaveLength(1))

    expect(esperas.value[0]?.posicion).toBe(1)
    detener()
  })
})
