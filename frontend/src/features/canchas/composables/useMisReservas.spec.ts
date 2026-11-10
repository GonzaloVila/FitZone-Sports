import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ErrorApi } from '@/compartido/http/errores'
import { ServiciosKey } from '@/compartido/servicios'
import { TIPOS_ERROR_CANCHAS } from '../errores'
import { POR_PAGINA_RESERVAS, useMisReservas } from './useMisReservas'

// RF-10: las reservas de cancha del usuario de la sesión, por pestaña (Próximas, Canceladas, Pasadas), con el
// estado de pago de cada una. La pestaña y la página viven en la dirección.
enableAutoUnmount(afterEach)

const reserva = (id: number) => ({
  id,
  canchaId: 4,
  usuarioId: 9,
  fechaHoraInicio: '2026-11-12T10:00:00-03:00',
  fechaHoraFin: '2026-11-12T11:00:00-03:00',
  estado: 'CONFIRMADA',
  precioAplicado: 12000,
})

const servicios = {
  sesion: {},
  canchas: { listarReservas: vi.fn(), cancelarReserva: vi.fn() },
  pagos: { listar: vi.fn() },
}

let router: ReturnType<typeof createRouter>

async function montar(opciones: { query?: Record<string, string>; usuarioId?: number | null } = {}) {
  router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/canchas', component: { render: () => null } }] })
  await router.push({ path: '/canchas', query: opciones.query ?? {} })
  const pinia = createPinia()
  const usuarioId = opciones.usuarioId === undefined ? 9 : opciones.usuarioId
  pinia.state.value.sesion = { usuario: usuarioId === null ? null : { rol: 'EXTERNO', usuarioId }, restaurada: true }
  let api!: ReturnType<typeof useMisReservas>
  mount(
    defineComponent({
      setup() {
        api = useMisReservas()
        return {}
      },
      template: '<div />',
    }),
    { global: { plugins: [pinia, router], provide: { [ServiciosKey as symbol]: servicios } } },
  )
  await flushPromises()
  return api
}

const ultimaConsulta = () => servicios.canchas.listarReservas.mock.lastCall!

describe('useMisReservas', () => {
  beforeEach(() => {
    servicios.canchas.listarReservas.mockReset().mockResolvedValue({ items: [reserva(1), reserva(2)], total: 2 })
    servicios.canchas.cancelarReserva.mockReset().mockResolvedValue(undefined)
    // La reserva 1 tiene un pago; la 2, ninguno.
    servicios.pagos.listar
      .mockReset()
      .mockImplementation(async ({ reservaCanchaId }: { reservaCanchaId: number }) => ({ items: [], total: reservaCanchaId === 1 ? 1 : 0 }))
  })

  it('arranca en Próximas, página 1, con las reservas del usuario y su estado de pago', async () => {
    const api = await montar()

    expect(ultimaConsulta()).toEqual([{ usuarioId: 9, estado: undefined }, 1, POR_PAGINA_RESERVAS, expect.any(AbortSignal)])
    expect(api.pestana.value).toBe('proximas')
    expect(api.filas.value.map((f) => [f.reserva.id, f.pago])).toEqual([
      [1, 'pagada'],
      [2, 'pendiente'],
    ])
    expect(api.cargando.value).toBe(false)
  })

  it('si no se puede saber el pago de una reserva, queda "sin dato"', async () => {
    servicios.pagos.listar.mockRejectedValue(new Error('caído'))

    const api = await montar()

    expect(api.filas.value.map((f) => f.pago)).toEqual(['sin-dato', 'sin-dato'])
  })

  it('lee la pestaña y la página de la dirección', async () => {
    await montar({ query: { pestana: 'canceladas', 'pagina-reservas': '2' } })

    expect(ultimaConsulta()).toEqual([{ usuarioId: 9, estado: 'CANCELADA' }, 2, POR_PAGINA_RESERVAS, expect.any(AbortSignal)])
  })

  it('cambiar de pestaña vuelve a la página 1, la escribe en la dirección y consulta', async () => {
    const api = await montar({ query: { 'pagina-reservas': '3' } })

    api.pestana.value = 'pasadas'
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ pestana: 'pasadas' })
    expect(ultimaConsulta()).toEqual([{ usuarioId: 9, estado: 'CUMPLIDA' }, 1, POR_PAGINA_RESERVAS, expect.any(AbortSignal)])
  })

  it('una pestaña desconocida cae en Próximas', async () => {
    const api = await montar({ query: { pestana: 'canceladas' } })

    api.pestana.value = 'cualquiera'
    await flushPromises()

    expect(api.pestana.value).toBe('proximas')
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('si la página quedó fuera de rango, vuelve a la última', async () => {
    servicios.canchas.listarReservas
      .mockResolvedValueOnce({ items: [], total: 13 })
      .mockResolvedValue({ items: [reserva(13)], total: 13 })

    const api = await montar({ query: { 'pagina-reservas': '5' } })

    expect(api.pagina.value).toBe(2)
    expect(ultimaConsulta()[1]).toBe(2)
    expect(api.totalPaginas.value).toBe(2)
  })

  it('sin usuario en la sesión no consulta nada', async () => {
    const api = await montar({ usuarioId: null })

    expect(servicios.canchas.listarReservas).not.toHaveBeenCalled()
    expect(api.sinUsuario.value).toBe(true)
    expect(api.filas.value).toEqual([])
  })

  it('un error de carga vacía la lista y deja el mensaje', async () => {
    servicios.canchas.listarReservas.mockRejectedValue(new Error('caído'))

    const api = await montar()

    expect(api.error.value).toBe('No se pudieron cargar tus reservas.')
    expect(api.filas.value).toEqual([])
    expect(api.total.value).toBe(0)
  })

  describe('cancelar (RF-10)', () => {
    it('cancela, avisa y recarga la lista', async () => {
      const api = await montar()
      const consultas = servicios.canchas.listarReservas.mock.calls.length

      expect(await api.cancelar(api.filas.value[0]!)).toBe(true)

      expect(servicios.canchas.cancelarReserva).toHaveBeenCalledWith(1)
      expect(api.exitoAccion.value).toBe('Reserva cancelada.')
      expect(servicios.canchas.listarReservas.mock.calls.length).toBe(consultas + 1)
      expect(api.accionando.value).toBe(false)
    })

    it('un turno ya empezado no se puede cancelar: muestra el motivo y recarga igual', async () => {
      const api = await montar()
      servicios.canchas.cancelarReserva.mockRejectedValue(
        new ErrorApi(409, 'x', { type: TIPOS_ERROR_CANCHAS.RESERVA_PASADA, title: 'x', status: 409, detail: 'x' }),
      )

      expect(await api.cancelar(api.filas.value[0]!)).toBe(false)

      expect(api.errorAccion.value).toBe('El turno ya comenzó: no se puede cancelar.')
      expect(api.exitoAccion.value).toBeNull()
    })

    it('no deja cancelar dos veces a la vez', async () => {
      const api = await montar()
      let terminar!: () => void
      servicios.canchas.cancelarReserva.mockImplementationOnce(() => new Promise<void>((r) => (terminar = r)))

      const primera = api.cancelar(api.filas.value[0]!)
      expect(await api.cancelar(api.filas.value[1]!)).toBe(false)
      terminar()
      await primera

      expect(servicios.canchas.cancelarReserva).toHaveBeenCalledTimes(1)
    })

    it('limpiarMensajes borra el resultado de la acción anterior', async () => {
      const api = await montar()
      await api.cancelar(api.filas.value[0]!)

      api.limpiarMensajes()

      expect(api.exitoAccion.value).toBeNull()
      expect(api.errorAccion.value).toBeNull()
    })
  })
})
