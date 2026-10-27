import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { ErrorApi } from '@/compartido/http/errores'

const mocks = vi.hoisted(() => ({
  crearReserva: vi.fn(),
  usuarioId: { value: 7 as number | null },
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ canchas: { crearReserva: mocks.crearReserva } }),
}))

vi.mock('@/features/sesion/composables/useUsuarioSesion', () => ({
  useUsuarioSesion: () => ({ usuarioId: mocks.usuarioId }),
}))

import { useReservarTurno } from './useReservarTurno'

const TURNO = {
  inicio: '2026-10-24T18:00:00-03:00',
  fin: '2026-10-24T19:00:00-03:00',
}

function armar() {
  const recargar = vi.fn()
  const scope = effectScope()
  const estado = scope.run(() => useReservarTurno(recargar))!
  return { ...estado, recargar, detener: () => scope.stop() }
}

describe('useReservarTurno', () => {
  beforeEach(() => {
    mocks.crearReserva.mockReset()
    mocks.usuarioId.value = 7
  })

  it('manda el usuarioId de la sesión y recarga la grilla al reservar', async () => {
    mocks.crearReserva.mockResolvedValue({ id: 10, precioAplicado: 4250 })
    const { reservar, reserva, recargar, detener } = armar()

    const ok = await reservar(3, TURNO)

    expect(ok).toBe(true)
    expect(mocks.crearReserva).toHaveBeenCalledWith({
      canchaId: 3,
      usuarioId: 7,
      fechaHoraInicio: TURNO.inicio,
      fechaHoraFin: TURNO.fin,
    })
    expect(reserva.value?.id).toBe(10)
    expect(recargar).toHaveBeenCalledTimes(1)
    detener()
  })

  it('traduce el 409 turno-ocupado y recarga la grilla', async () => {
    mocks.crearReserva.mockRejectedValue(
      new ErrorApi(409, 'Otro usuario reservó el turno.', {
        type: 'https://fitzone.app/errores/turno-ocupado',
        title: 'Turno ocupado',
        status: 409,
        detail: 'Otro usuario reservó el turno.',
      }),
    )
    const { reservar, error, recargar, detener } = armar()

    const ok = await reservar(3, TURNO)

    expect(ok).toBe(false)
    expect(error.value).toBe('Ese turno acaba de ser tomado, elegí otro.')
    expect(recargar).toHaveBeenCalledTimes(1)
    detener()
  })

  it('un 422 crudo del servidor se muestra como texto humano y no recarga la grilla', async () => {
    mocks.crearReserva.mockRejectedValue(
      new ErrorApi(422, 'Turno pasado', {
        type: 'about:blank',
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Turno pasado',
      }),
    )
    const { reservar, error, recargar, detener } = armar()

    const ok = await reservar(3, TURNO)

    expect(ok).toBe(false)
    expect(error.value).toBe('No se pudo reservar ese turno. Probá con otro horario.')
    expect(recargar).not.toHaveBeenCalled()
    detener()
  })

  it('no llama al servicio sin usuarioId en la sesión', async () => {
    mocks.usuarioId.value = null
    const { reservar, error, detener } = armar()

    const ok = await reservar(3, TURNO)

    expect(ok).toBe(false)
    expect(mocks.crearReserva).not.toHaveBeenCalled()
    expect(error.value).toMatch(/usuario de la sesión/i)
    detener()
  })
})
