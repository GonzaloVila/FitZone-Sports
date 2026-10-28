import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { ErrorApi } from '@/compartido/http/errores'

const mocks = vi.hoisted(() => ({
  procesar: vi.fn(),
  listar: vi.fn(),
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({
    pagos: { procesar: mocks.procesar, listar: mocks.listar },
  }),
}))

import { TIPO_IDEMPOTENCIA_REPETIDA } from '../errores'
import { MENSAJE_SIN_MEDIO, usePagarReserva } from './usePagarReserva'

const RESERVA = {
  id: 7,
  canchaId: 3,
  usuarioId: 7,
  fechaHoraInicio: '2026-10-24T18:00:00-03:00',
  fechaHoraFin: '2026-10-24T19:00:00-03:00',
  estado: 'CONFIRMADA' as const,
  precioAplicado: 4250,
}

// El medio ya elegido, como si la persona lo hubiera marcado en el select.
function armar(medio = 'aprobada') {
  const scope = effectScope()
  const estado = scope.run(() => usePagarReserva(() => RESERVA))!
  estado.medio.value = medio
  return { ...estado, detener: () => scope.stop() }
}

describe('usePagarReserva', () => {
  beforeEach(() => {
    mocks.procesar.mockReset()
    mocks.listar.mockReset()
  })

  it('arranca sin medio elegido, sin error y sin resultado', () => {
    const scope = effectScope()
    const { medio, errorMedio, error, pago } = scope.run(() => usePagarReserva(() => RESERVA))!

    expect(medio.value).toBe('')
    expect(errorMedio.value).toBeNull()
    expect(error.value).toBeNull()
    expect(pago.value).toBeNull()
    scope.stop()
  })

  it('sin medio elegido avisa dentro del modal y no manda nada al servidor', async () => {
    const { pagar, medio, errorMedio, error, detener } = armar('')

    expect(await pagar()).toBeNull()

    expect(errorMedio.value).toBe(MENSAJE_SIN_MEDIO)
    expect(MENSAJE_SIN_MEDIO).toBe('Elegí un medio de pago.')
    expect(error.value).toBeNull()
    expect(mocks.procesar).not.toHaveBeenCalled()

    medio.value = 'aprobada'
    await vi.waitFor(() => expect(errorMedio.value).toBeNull())
    detener()
  })

  it('un valor que no es un medio conocido tampoco se manda', async () => {
    const { pagar, errorMedio, detener } = armar('tok_cualquiera')
    // Elegir un medio limpia el error del campo: se espera a que ese cambio se asiente antes de pagar.
    await nextTick()

    expect(await pagar()).toBeNull()

    expect(errorMedio.value).toBe(MENSAJE_SIN_MEDIO)
    expect(mocks.procesar).not.toHaveBeenCalled()
    detener()
  })

  it('manda el token del medio elegido, que es opaco y no queda en el estado', async () => {
    mocks.procesar.mockResolvedValue({ id: 1, estado: 'APROBADO', monto: 4250 })
    const { pagar, medio, detener } = armar('rechazada')

    await pagar()

    expect(medio.value).toBe('rechazada')
    expect(mocks.procesar.mock.calls[0]?.[0]).toMatchObject({ token: 'tok_rechazado_demo' })
    detener()
  })

  it('reutiliza la misma Idempotency-Key cuando el reintento es por un corte de red', async () => {
    mocks.procesar
      .mockRejectedValueOnce(new ErrorApi(0, 'No se pudo conectar con el servidor'))
      .mockResolvedValueOnce({ id: 1, estado: 'APROBADO', monto: 4250 })
    const { pagar, detener } = armar()

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
    const { pagar, error, detener } = armar()

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
    const { pagar, pago, detener } = armar()

    const resultado = await pagar()

    expect(resultado?.id).toBe(9)
    expect(pago.value?.id).toBe(9)
    expect(mocks.listar).toHaveBeenCalledWith({ reservaCanchaId: 7 }, 1, 1)
    detener()
  })

  it('dos cobros seguidos de reservas distintas con el mismo composable mandan claves distintas', async () => {
    mocks.procesar.mockResolvedValue({ id: 1, estado: 'APROBADO', monto: 4250 })
    const reserva = ref<typeof RESERVA | null>(RESERVA)
    const scope = effectScope()
    const { pagar, medio } = scope.run(() => usePagarReserva(reserva))!
    medio.value = 'aprobada'

    await pagar()
    // Sin reiniciar: la clave del primer cobro no puede pasar a otra reserva.
    reserva.value = { ...RESERVA, id: 8 }
    await pagar()

    const [primera, segunda] = mocks.procesar.mock.calls.map((llamada) => llamada[1])
    expect(primera).toBeTruthy()
    expect(segunda).toBeTruthy()
    expect(primera).not.toBe(segunda)
    expect(mocks.procesar.mock.calls[1]?.[0]).toMatchObject({ concepto: { reservaCanchaId: 8 } })
    scope.stop()
  })

  it('un reintento de la misma reserva tras un corte de red conserva la clave aunque haya otra reserva en el medio', async () => {
    mocks.procesar
      .mockRejectedValueOnce(new ErrorApi(0, 'No se pudo conectar con el servidor'))
      .mockResolvedValueOnce({ id: 1, estado: 'APROBADO', monto: 4250 })
    const { pagar, detener } = armar()

    await pagar()
    await pagar()

    const [primera, segunda] = mocks.procesar.mock.calls.map((llamada) => llamada[1])
    expect(primera).toBe(segunda)
    detener()
  })

  it('un 409 de idempotencia sin ningún pago de la reserva no dice "ya procesado": pide reintentar con una clave nueva', async () => {
    mocks.procesar
      .mockRejectedValueOnce(new ErrorApi(409, 'Clave repetida.', {
        type: TIPO_IDEMPOTENCIA_REPETIDA,
        title: 'Conflicto',
        status: 409,
        detail: 'Clave repetida.',
      }))
      .mockResolvedValueOnce({ id: 3, estado: 'APROBADO', monto: 4250 })
    mocks.listar.mockResolvedValue({ items: [], total: 0 })
    const { pagar, error, pago, detener } = armar()

    expect(await pagar()).toBeNull()
    expect(error.value).toBe('No se pudo procesar el pago. Probá de nuevo.')
    expect(pago.value).toBeNull()

    expect(await pagar()).not.toBeNull()
    const [primera, segunda] = mocks.procesar.mock.calls.map((llamada) => llamada[1])
    expect(primera).not.toBe(segunda)
    detener()
  })

  it('un 409 de otro tipo sin pago sigue diciendo que el cobro ya fue procesado', async () => {
    mocks.procesar.mockRejectedValueOnce(new ErrorApi(409, 'Reserva ya cobrada.'))
    mocks.listar.mockResolvedValue({ items: [], total: 0 })
    const { pagar, error, detener } = armar()

    expect(await pagar()).toBeNull()

    expect(error.value).toBe('Ese cobro ya fue procesado.')
    detener()
  })

  it('reiniciar deja todo como recién abierto y el próximo cobro usa una clave nueva', async () => {
    mocks.procesar
      .mockResolvedValueOnce({ id: 1, estado: 'APROBADO', monto: 4250 })
      .mockResolvedValueOnce({ id: 2, estado: 'APROBADO', monto: 4250 })
    const { pagar, reiniciar, medio, pago, error, errorMedio, detener } = armar()

    await pagar()
    expect(pago.value?.id).toBe(1)

    reiniciar()

    expect(medio.value).toBe('')
    expect(pago.value).toBeNull()
    expect(error.value).toBeNull()
    expect(errorMedio.value).toBeNull()

    medio.value = 'aprobada'
    await pagar()
    const [primera, segunda] = mocks.procesar.mock.calls.map((llamada) => llamada[1])
    expect(primera).not.toBe(segunda)
    detener()
  })

  it('sin reserva no cobra nada', async () => {
    const reserva = ref<typeof RESERVA | null>(null)
    const scope = effectScope()
    const { pagar, medio } = scope.run(() => usePagarReserva(reserva))!
    medio.value = 'aprobada'

    expect(await pagar()).toBeNull()
    expect(mocks.procesar).not.toHaveBeenCalled()
    scope.stop()
  })
})
