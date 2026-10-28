import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'

const mocks = vi.hoisted(() => ({
  obtenerReserva: vi.fn(),
  route: { query: {} as Record<string, unknown> },
  replace: vi.fn(),
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ canchas: { obtenerReserva: mocks.obtenerReserva } }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace }),
}))

import { useReservaAPagar } from './useReservaAPagar'

const RESERVA = {
  id: 12,
  canchaId: 3,
  usuarioId: 7,
  fechaHoraInicio: '2026-10-24T18:00:00-03:00',
  fechaHoraFin: '2026-10-24T19:00:00-03:00',
  estado: 'CONFIRMADA' as const,
  precioAplicado: 4250,
}

function armar() {
  const abrir = vi.fn()
  const scope = effectScope()
  const estado = scope.run(() => useReservaAPagar(abrir))!
  return { ...estado, abrir, detener: () => scope.stop() }
}

describe('useReservaAPagar', () => {
  beforeEach(() => {
    mocks.route = reactive({ query: {} as Record<string, unknown> })
    mocks.obtenerReserva.mockReset().mockResolvedValue(RESERVA)
    mocks.replace.mockReset()
  })

  it('sin ?pagar= no pide nada', () => {
    const { abrir, detener } = armar()

    expect(mocks.obtenerReserva).not.toHaveBeenCalled()
    expect(abrir).not.toHaveBeenCalled()
    detener()
  })

  it('con ?pagar=<id> trae esa reserva, abre el pago y quita el parámetro de la dirección', async () => {
    mocks.route.query = { vista: 'mis-reservas', pagar: '12' }
    const { abrir, error, detener } = armar()

    await vi.waitFor(() => expect(abrir).toHaveBeenCalledWith(RESERVA))

    expect(mocks.obtenerReserva).toHaveBeenCalledWith(12)
    expect(mocks.replace).toHaveBeenCalledWith({ query: { vista: 'mis-reservas' } })
    expect(error.value).toBeNull()
    detener()
  })

  it('un id inválido se ignora', async () => {
    mocks.route.query = { pagar: 'abc' }
    const { abrir, detener } = armar()
    await nextTick()

    expect(mocks.obtenerReserva).not.toHaveBeenCalled()
    expect(abrir).not.toHaveBeenCalled()
    detener()
  })

  it('una reserva cancelada no abre el pago y lo dice', async () => {
    mocks.route.query = { pagar: '12' }
    mocks.obtenerReserva.mockResolvedValue({ ...RESERVA, estado: 'CANCELADA' })
    const { abrir, error, detener } = armar()

    await vi.waitFor(() => expect(error.value).toBe('Esa reserva está cancelada: no se puede pagar.'))

    expect(abrir).not.toHaveBeenCalled()
    detener()
  })

  it('si no se puede traer la reserva deja el error y no abre nada', async () => {
    mocks.route.query = { pagar: '12' }
    mocks.obtenerReserva.mockRejectedValue(new Error('sin conexión'))
    const { abrir, error, detener } = armar()

    await vi.waitFor(() => expect(error.value).not.toBeNull())

    expect(abrir).not.toHaveBeenCalled()
    detener()
  })
})
