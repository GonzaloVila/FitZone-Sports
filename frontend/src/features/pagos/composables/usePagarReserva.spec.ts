import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { ErrorApi } from '@/compartido/http/errores'

const mocks = vi.hoisted(() => ({
  obtenerReserva: vi.fn(),
  procesar: vi.fn(),
  listar: vi.fn(),
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({
    canchas: { obtenerReserva: mocks.obtenerReserva },
    pagos: { procesar: mocks.procesar, listar: mocks.listar },
  }),
}))

import { usePagarReserva } from './usePagarReserva'

const RESERVA = {
  id: 7,
  canchaId: 3,
  usuarioId: 7,
  fechaHoraInicio: '2026-10-24T18:00:00-03:00',
  fechaHoraFin: '2026-10-24T19:00:00-03:00',
  estado: 'CONFIRMADA' as const,
  precioAplicado: 4250,
}

async function armar() {
  const scope = effectScope()
  const estado = scope.run(() => usePagarReserva(7))!
  await vi.waitFor(() => expect(estado.reserva.value?.id).toBe(7))
  return { ...estado, detener: () => scope.stop() }
}

describe('usePagarReserva', () => {
  beforeEach(() => {
    mocks.obtenerReserva.mockReset().mockResolvedValue(RESERVA)
    mocks.procesar.mockReset()
    mocks.listar.mockReset()
  })

  it('reutiliza la misma Idempotency-Key cuando el reintento es por un corte de red', async () => {
    mocks.procesar
      .mockRejectedValueOnce(new ErrorApi(0, 'No se pudo conectar con el servidor'))
      .mockResolvedValueOnce({ id: 1, estado: 'APROBADO', monto: 4250 })
    const { pagar, detener } = await armar()

    expect(await pagar()).toBeNull()
    expect(await pagar()).not.toBeNull()

    const [primera, segunda] = mocks.procesar.mock.calls.map((llamada) => llamada[1])
    expect(primera).toBe(segunda)
    detener()
  })

  it('usa una clave nueva después de un 402 y manda moneda ARS', async () => {
    mocks.procesar
      .mockRejectedValueOnce(new ErrorApi(402, 'El pago fue rechazado.'))
      .mockResolvedValueOnce({ id: 2, estado: 'APROBADO', monto: 4250 })
    const { pagar, error, detener } = await armar()

    expect(await pagar()).toBeNull()
    expect(error.value).toBe('El pago fue rechazado.')
    expect(await pagar()).not.toBeNull()

    const [primera, segunda] = mocks.procesar.mock.calls.map((llamada) => llamada[1])
    expect(primera).not.toBe(segunda)
    expect(mocks.procesar.mock.calls[1]?.[0]).toMatchObject({
      moneda: 'ARS',
      concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: 7 },
    })
    detener()
  })

  it('ante un 409 muestra el pago real de la reserva', async () => {
    mocks.procesar.mockRejectedValueOnce(new ErrorApi(409, 'Ese cobro ya fue procesado.'))
    mocks.listar.mockResolvedValueOnce({ items: [{ id: 9, estado: 'APROBADO', monto: 4250 }], total: 1 })
    const { pagar, pago, detener } = await armar()

    const resultado = await pagar()

    expect(resultado?.id).toBe(9)
    expect(pago.value?.id).toBe(9)
    expect(mocks.listar).toHaveBeenCalledWith({ reservaCanchaId: 7 }, 1, 1)
    detener()
  })
})
