import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  listarReservas: vi.fn(),
  obtenerUsuario: vi.fn(),
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({
    canchas: { listarReservas: mocks.listarReservas },
    usuarios: { obtener: mocks.obtenerUsuario },
  }),
}))

import { reservanteDe, useReservantesDelDia } from './useReservantesDelDia'

const reserva = (id: number, usuarioId: number, fechaHoraInicio: string) => ({
  id,
  canchaId: 3,
  usuarioId,
  fechaHoraInicio,
  fechaHoraFin: fechaHoraInicio,
  estado: 'CONFIRMADA',
  precioAplicado: 4000,
})

const lista = (...items: ReturnType<typeof reserva>[]) => ({ items, total: items.length })

function armar(opciones: { habilitado?: boolean; fecha?: string } = {}) {
  const habilitado = ref(opciones.habilitado ?? true)
  const fecha = ref(opciones.fecha ?? '2026-11-14')
  const turnos = ref<unknown[]>([])
  const scope = effectScope()
  const estado = scope.run(() => useReservantesDelDia(3, fecha, habilitado, turnos))!
  return { ...estado, habilitado, fecha, turnos, detener: () => scope.stop() }
}

// Deja pasar las promesas pendientes.
const asentar = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
  await nextTick()
}

describe('useReservantesDelDia', () => {
  beforeEach(() => {
    mocks.listarReservas.mockReset().mockResolvedValue(lista())
    mocks.obtenerUsuario.mockReset().mockImplementation(async (id: number) => ({ id, nombre: `Persona ${id}` }))
  })

  it('pide las reservas confirmadas de esa cancha y ese día, con el perPage máximo', async () => {
    const { detener } = armar()
    await asentar()

    expect(mocks.listarReservas).toHaveBeenCalledTimes(1)
    expect(mocks.listarReservas).toHaveBeenCalledWith(
      { canchaId: 3, fecha: '2026-11-14', estado: 'CONFIRMADA' },
      1,
      100,
      expect.anything(),
    )
    detener()
  })

  it('empareja cada reserva con su turno por instante, aunque el texto de la hora tenga otro offset', async () => {
    mocks.listarReservas.mockResolvedValue(lista(reserva(1, 12, '2026-11-14T18:00:00-03:00'), reserva(2, 15, '2026-11-14T19:00:00-03:00')))
    const { reservantes, detener } = armar()
    await vi.waitFor(() => expect(reservantes.value.size).toBe(2))
    await asentar()

    // El turno de la grilla llega en UTC; es el mismo instante que las 18:00 de Buenos Aires.
    expect(reservanteDe(reservantes.value, '2026-11-14T21:00:00.000Z')).toEqual({ usuarioId: 12, nombre: 'Persona 12' })
    expect(reservanteDe(reservantes.value, '2026-11-14T22:00:00Z')).toEqual({ usuarioId: 15, nombre: 'Persona 15' })
    expect(reservanteDe(reservantes.value, '2026-11-14T23:00:00Z')).toBeUndefined()
    detener()
  })

  it('si el rol no corresponde no hace ningún pedido', async () => {
    const { reservantes, detener } = armar({ habilitado: false })
    await asentar()

    expect(mocks.listarReservas).not.toHaveBeenCalled()
    expect(mocks.obtenerUsuario).not.toHaveBeenCalled()
    expect(reservantes.value.size).toBe(0)
    detener()
  })

  it('usa la caché: un solo pedido de nombre para dos turnos del mismo usuario', async () => {
    mocks.listarReservas.mockResolvedValue(lista(reserva(1, 12, '2026-11-14T18:00:00-03:00'), reserva(2, 12, '2026-11-14T19:00:00-03:00')))
    const { reservantes, detener } = armar()
    await vi.waitFor(() => expect(reservanteDe(reservantes.value, '2026-11-14T22:00:00Z')?.nombre).toBe('Persona 12'))

    expect(mocks.obtenerUsuario).toHaveBeenCalledTimes(1)
    detener()
  })

  it('la caché también vale entre cargas: no vuelve a pedir un nombre que ya tiene', async () => {
    mocks.listarReservas.mockResolvedValue(lista(reserva(1, 12, '2026-11-14T18:00:00-03:00')))
    const { turnos, reservantes, detener } = armar()
    await vi.waitFor(() => expect(reservanteDe(reservantes.value, '2026-11-14T21:00:00Z')?.nombre).toBe('Persona 12'))

    turnos.value = [{}] // la grilla se refrescó
    await asentar()

    expect(mocks.listarReservas).toHaveBeenCalledTimes(2)
    expect(mocks.obtenerUsuario).toHaveBeenCalledTimes(1)
    detener()
  })

  it('si el pedido de un nombre falla, el turno queda con nombre null ("Usuario #id") y no se rompe nada', async () => {
    mocks.listarReservas.mockResolvedValue(lista(reserva(1, 12, '2026-11-14T18:00:00-03:00'), reserva(2, 15, '2026-11-14T19:00:00-03:00')))
    mocks.obtenerUsuario.mockImplementation(async (id: number) => {
      if (id === 12) throw new Error('403')
      return { id, nombre: `Persona ${id}` }
    })
    const { reservantes, detener } = armar()
    await vi.waitFor(() => expect(reservanteDe(reservantes.value, '2026-11-14T22:00:00Z')?.nombre).toBe('Persona 15'))

    expect(reservanteDe(reservantes.value, '2026-11-14T21:00:00Z')).toEqual({ usuarioId: 12, nombre: null })
    detener()
  })

  it('un nombre que falló se vuelve a intentar en la carga siguiente', async () => {
    mocks.listarReservas.mockResolvedValue(lista(reserva(1, 12, '2026-11-14T18:00:00-03:00')))
    mocks.obtenerUsuario.mockRejectedValueOnce(new Error('red')).mockResolvedValue({ id: 12, nombre: 'Persona 12' })
    const { turnos, reservantes, detener } = armar()
    await asentar()
    expect(reservanteDe(reservantes.value, '2026-11-14T21:00:00Z')?.nombre).toBeNull()

    turnos.value = [{}]
    await vi.waitFor(() => expect(reservanteDe(reservantes.value, '2026-11-14T21:00:00Z')?.nombre).toBe('Persona 12'))
    detener()
  })

  it('si falla el pedido de las reservas la columna queda vacía, sin error', async () => {
    mocks.listarReservas.mockRejectedValue(new Error('500'))
    const { reservantes, detener } = armar()
    await asentar()

    expect(reservantes.value.size).toBe(0)
    detener()
  })

  it('pide como mucho 4 nombres a la vez', async () => {
    mocks.listarReservas.mockResolvedValue(
      lista(...Array.from({ length: 9 }, (_, i) => reserva(i + 1, 100 + i, `2026-11-14T${String(8 + i).padStart(2, '0')}:00:00-03:00`))),
    )
    let enCurso = 0
    let maximo = 0
    mocks.obtenerUsuario.mockImplementation(async (id: number) => {
      enCurso++
      maximo = Math.max(maximo, enCurso)
      await new Promise((resolver) => setTimeout(resolver, 5))
      enCurso--
      return { id, nombre: `Persona ${id}` }
    })
    const { reservantes, detener } = armar()
    await vi.waitFor(() => {
      expect(reservantes.value.size).toBe(9)
      expect([...reservantes.value.values()].every((r) => r.nombre !== null)).toBe(true)
    })

    expect(mocks.obtenerUsuario).toHaveBeenCalledTimes(9)
    expect(maximo).toBe(4)
    detener()
  })

  it('una respuesta vieja no pisa a la nueva (cambio de fecha con la primera todavía en camino)', async () => {
    let soltarPrimera!: (valor: unknown) => void
    mocks.listarReservas
      .mockImplementationOnce(() => new Promise((resolver) => (soltarPrimera = resolver)))
      .mockResolvedValueOnce(lista(reserva(2, 15, '2026-11-15T19:00:00-03:00')))
    const { fecha, reservantes, detener } = armar()
    await asentar()

    fecha.value = '2026-11-15'
    await vi.waitFor(() => expect(reservanteDe(reservantes.value, '2026-11-15T22:00:00Z')?.usuarioId).toBe(15))
    soltarPrimera(lista(reserva(1, 12, '2026-11-14T18:00:00-03:00')))
    await asentar()

    expect([...reservantes.value.values()].map((r) => r.usuarioId)).toEqual([15])
    detener()
  })

  it('al desactivarse (otro rol) vacía el mapa', async () => {
    mocks.listarReservas.mockResolvedValue(lista(reserva(1, 12, '2026-11-14T18:00:00-03:00')))
    const { habilitado, reservantes, detener } = armar()
    await vi.waitFor(() => expect(reservantes.value.size).toBe(1))

    habilitado.value = false
    await asentar()

    expect(reservantes.value.size).toBe(0)
    detener()
  })
})
