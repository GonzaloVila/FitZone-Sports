import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { limpiarPenalidadCobrada, usePenalidadCobrada } from '@/compartido/composables/usePenalidadCobrada'

const mocks = vi.hoisted(() => ({
  obtener: vi.fn(),
  listarReservas: vi.fn(),
  listarEsperas: vi.fn(),
  listarEsperaDeClase: vi.fn(),
  listarInscriptos: vi.fn(),
  reservar: vi.fn(),
  cancelarReserva: vi.fn(),
  anotarseEnEspera: vi.fn(),
  salirDeEspera: vi.fn(),
  listarPagos: vi.fn(),
  rol: { value: 'SOCIO' as string | null },
  socioId: { value: 1 as number | null },
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({
    clases: {
      obtener: mocks.obtener,
      listarReservas: mocks.listarReservas,
      listarEsperas: mocks.listarEsperas,
      listarEsperaDeClase: mocks.listarEsperaDeClase,
      reservar: mocks.reservar,
      cancelarReserva: mocks.cancelarReserva,
      anotarseEnEspera: mocks.anotarseEnEspera,
      salirDeEspera: mocks.salirDeEspera,
      listarInscriptos: mocks.listarInscriptos,
      confirmarEspera: vi.fn(),
    },
    pagos: { listar: mocks.listarPagos, descargarComprobante: vi.fn() },
  }),
}))

vi.mock('@/features/sesion/composables/useUsuarioSesion', () => ({
  useUsuarioSesion: () => ({ rol: mocks.rol, socioId: mocks.socioId }),
}))

import { formatearHorario } from '../presentacion'
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

const vacia = { items: [], total: 0 }
const lista = (...items: unknown[]) => ({ items, total: items.length })

async function armar() {
  const scope = effectScope()
  const id = ref(7)
  const estado = scope.run(() => useDetalleClase(() => id.value))!
  await vi.waitFor(() => expect(estado.cargando.value).toBe(false))
  return { ...estado, detener: () => scope.stop() }
}

describe('useDetalleClase: reserva y espera vigentes', () => {
  beforeEach(() => {
    limpiarPenalidadCobrada()
    mocks.obtener.mockReset().mockResolvedValue(CLASE)
    mocks.listarReservas.mockReset().mockResolvedValue(vacia)
    mocks.listarEsperas.mockReset().mockResolvedValue(vacia)
    mocks.listarEsperaDeClase.mockReset().mockResolvedValue(vacia)
    mocks.reservar.mockReset().mockResolvedValue({})
    mocks.cancelarReserva.mockReset().mockResolvedValue(undefined)
    mocks.anotarseEnEspera.mockReset().mockResolvedValue({})
    mocks.salirDeEspera.mockReset().mockResolvedValue(undefined)
    mocks.listarPagos.mockReset().mockResolvedValue(vacia)
    mocks.rol.value = 'SOCIO'
    mocks.socioId.value = 1
  })

  it('con una espera cancelada y otra en espera toma la vigente y calcula su lugar', async () => {
    mocks.listarEsperas.mockResolvedValue(
      lista({ id: 3, estado: 'CANCELADO' }, { id: 4, estado: 'EN_ESPERA' }),
    )
    mocks.listarEsperaDeClase.mockResolvedValue(lista({ id: 9, estado: 'EN_ESPERA' }, { id: 4, estado: 'EN_ESPERA' }))

    const { espera, posicionEnEspera, detener } = await armar()

    expect(espera.value?.id).toBe(4)
    expect(posicionEnEspera.value).toBe(2)
    detener()
  })

  it('salir de la espera deja la pantalla sin espera (ofrece anotarse otra vez) y sin pedir la cola', async () => {
    mocks.listarEsperas.mockResolvedValue(lista({ id: 3, estado: 'EN_ESPERA' }))
    mocks.listarEsperaDeClase.mockResolvedValue(lista({ id: 3, estado: 'EN_ESPERA' }))
    const { espera, reserva, salirDeEspera, detener } = await armar()
    expect(espera.value?.id).toBe(3)

    // El servidor deja la anotación anterior como CANCELADO y la sigue devolviendo en el listado.
    mocks.listarEsperas.mockResolvedValue(lista({ id: 3, estado: 'CANCELADO' }))
    mocks.listarEsperaDeClase.mockClear()
    expect(await salirDeEspera()).toBe(true)

    expect(espera.value).toBeNull()
    expect(reserva.value).toBeNull()
    expect(mocks.listarEsperaDeClase).not.toHaveBeenCalled()
    detener()
  })

  it('después de salir, anotarse de nuevo toma la anotación nueva y no la cancelada', async () => {
    mocks.listarEsperas.mockResolvedValue(lista({ id: 3, estado: 'CANCELADO' }))
    const { espera, posicionEnEspera, anotarseEnEspera, detener } = await armar()
    expect(espera.value).toBeNull()

    mocks.listarEsperas.mockResolvedValue(lista({ id: 3, estado: 'CANCELADO' }, { id: 5, estado: 'EN_ESPERA' }))
    mocks.listarEsperaDeClase.mockResolvedValue(lista({ id: 5, estado: 'EN_ESPERA' }))
    expect(await anotarseEnEspera()).toBe(true)

    expect(mocks.anotarseEnEspera).toHaveBeenCalledWith(7, 1)
    expect(espera.value?.id).toBe(5)
    expect(posicionEnEspera.value).toBe(1)
    detener()
  })

  it('reservar, cancelar y reservar de nuevo toma la reserva vigente y no la cancelada', async () => {
    mocks.listarReservas.mockResolvedValue(lista({ id: 5, claseId: 7, socioId: 1, estado: 'CONFIRMADA' }))
    const { reserva, cancelarReserva, reservar, detener } = await armar()
    expect(reserva.value?.id).toBe(5)

    mocks.listarReservas.mockResolvedValue(lista({ id: 5, claseId: 7, socioId: 1, estado: 'CANCELADA' }))
    expect(await cancelarReserva()).toBe(true)
    expect(reserva.value).toBeNull()

    mocks.listarReservas.mockResolvedValue(
      lista(
        { id: 5, claseId: 7, socioId: 1, estado: 'CANCELADA' },
        { id: 6, claseId: 7, socioId: 1, estado: 'CONFIRMADA' },
      ),
    )
    expect(await reservar()).toBe(true)

    expect(reserva.value?.id).toBe(6)
    detener()
  })
})

describe('useDetalleClase: cola de espera y ocupación sin canceladas', () => {
  beforeEach(() => {
    limpiarPenalidadCobrada()
    mocks.obtener.mockReset().mockResolvedValue(CLASE)
    mocks.listarReservas.mockReset().mockResolvedValue(vacia)
    mocks.listarEsperas.mockReset().mockResolvedValue(vacia)
    mocks.listarEsperaDeClase.mockReset().mockResolvedValue(vacia)
    mocks.listarInscriptos.mockReset().mockResolvedValue(vacia)
    mocks.rol.value = 'GERENTE'
    mocks.socioId.value = null
  })

  it('el personal ve en la cola solo las esperas vigentes, y la primera vigente es la 1', async () => {
    mocks.listarEsperaDeClase.mockResolvedValue(
      lista({ id: 3, estado: 'CANCELADO' }, { id: 4, estado: 'EN_ESPERA' }, { id: 5, estado: 'NOTIFICADO' }),
    )

    const { listaEspera, detener } = await armar()

    expect(listaEspera.value.map((e) => e.id)).toEqual([4, 5])
    detener()
  })

  it('una cola solo de canceladas queda vacía', async () => {
    mocks.listarEsperaDeClase.mockResolvedValue(lista({ id: 3, estado: 'CANCELADO' }))

    const { listaEspera, detener } = await armar()

    expect(listaEspera.value).toEqual([])
    detener()
  })

  it('el personal ve en la ocupación solo las reservas no canceladas', async () => {
    mocks.listarInscriptos.mockResolvedValue(
      lista({ id: 1, estado: 'CANCELADA' }, { id: 2, estado: 'CONFIRMADA' }, { id: 3, estado: 'CANCELADA' }),
    )

    const { inscriptos, detener } = await armar()

    expect(inscriptos.value.map((r) => r.id)).toEqual([2])
    detener()
  })

  it('el socio anotado después de una espera cancelada está en el lugar 1', async () => {
    mocks.rol.value = 'SOCIO'
    mocks.socioId.value = 1
    mocks.listarEsperas.mockResolvedValue(lista({ id: 4, estado: 'EN_ESPERA' }))
    mocks.listarEsperaDeClase.mockResolvedValue(lista({ id: 3, estado: 'CANCELADO' }, { id: 4, estado: 'EN_ESPERA' }))

    const { posicionEnEspera, detener } = await armar()

    expect(posicionEnEspera.value).toBe(1)
    detener()
  })

  it('con otra vigente antes, el lugar sigue contando solo las vigentes (sin huecos)', async () => {
    mocks.rol.value = 'SOCIO'
    mocks.socioId.value = 1
    mocks.listarEsperas.mockResolvedValue(lista({ id: 6, estado: 'EN_ESPERA' }))
    mocks.listarEsperaDeClase.mockResolvedValue(
      lista(
        { id: 3, estado: 'CANCELADO' },
        { id: 4, estado: 'EN_ESPERA' },
        { id: 5, estado: 'CANCELADO' },
        { id: 6, estado: 'EN_ESPERA' },
      ),
    )

    const { posicionEnEspera, detener } = await armar()

    expect(posicionEnEspera.value).toBe(2)
    detener()
  })
})

describe('useDetalleClase: cancelar una reserva', () => {
  beforeEach(() => {
    limpiarPenalidadCobrada()
    mocks.obtener.mockReset().mockResolvedValue(CLASE)
    mocks.listarReservas
      .mockReset()
      .mockResolvedValue(lista({ id: 5, claseId: 7, socioId: 1, estado: 'CONFIRMADA' }))
    mocks.listarEsperas.mockReset().mockResolvedValue(vacia)
    mocks.listarEsperaDeClase.mockReset().mockResolvedValue(vacia)
    mocks.reservar.mockReset().mockResolvedValue({})
    mocks.cancelarReserva.mockReset().mockResolvedValue(undefined)
    mocks.listarPagos.mockReset().mockResolvedValue(vacia)
    mocks.rol.value = 'SOCIO'
    mocks.socioId.value = 1
  })

  it('sin penalidad deja el mensaje simple y no registra ningún aviso', async () => {
    const { cancelarReserva, exitoAccion, detener } = await armar()

    expect(await cancelarReserva()).toBe(true)

    expect(exitoAccion.value).toBe('Reserva cancelada.')
    expect(usePenalidadCobrada().penalidad.value).toBeNull()
    detener()
  })

  it('con penalidad registra el aviso persistente con el importe del servidor', async () => {
    mocks.listarPagos.mockResolvedValue(lista({ id: 99, monto: 5000, estado: 'APROBADO' }))
    const { cancelarReserva, exitoAccion, detener } = await armar()

    expect(await cancelarReserva()).toBe(true)

    expect(mocks.listarPagos).toHaveBeenCalledWith({ reservaClaseId: 5 }, 1, 1)
    expect(usePenalidadCobrada().penalidad.value).toEqual({
      pagoId: 99,
      monto: 5000,
      clase: { id: 7, tipo: 'Spinning', horario: formatearHorario(CLASE) },
    })
    expect(exitoAccion.value).toBeNull()
    detener()
  })

  it('tras cancelar se puede reservar de nuevo: no queda ningún bloqueo', async () => {
    const { cancelarReserva, reservar, errorAccion, detener } = await armar()
    await cancelarReserva()

    mocks.listarReservas.mockResolvedValue(lista({ id: 5, claseId: 7, socioId: 1, estado: 'CANCELADA' }))
    expect(await reservar()).toBe(true)

    expect(mocks.reservar).toHaveBeenCalledWith(7, 1)
    expect(errorAccion.value).toBeNull()
    detener()
  })

  it('si cancelar falla no registra penalidad y deja el error', async () => {
    mocks.cancelarReserva.mockRejectedValue(new Error('boom'))
    const { cancelarReserva, errorAccion, detener } = await armar()

    expect(await cancelarReserva()).toBe(false)

    expect(errorAccion.value).toBeTruthy()
    expect(mocks.listarPagos).not.toHaveBeenCalled()
    detener()
  })
})
