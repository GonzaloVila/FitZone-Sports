import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ErrorApi } from '@/compartido/http/errores'
import { ServiciosKey } from '@/compartido/servicios'
import { TIPOS_ERROR_CANCHAS } from '../errores'
import GrillaTurnosPage from './GrillaTurnosPage.vue'

// RF-10 / RN-02: la grilla de turnos de una cancha. Quien juega (SOCIO, EXTERNO) reserva un turno libre y confirma; si
// otro lo tomó antes, el modal sigue abierto con el motivo y la grilla se vuelve a pedir. El personal solo consulta y ve
// quién reservó. El pago se reemplaza por un stub (tiene su propio spec en pagos).
enableAutoUnmount(afterEach)

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  const dialogo = HTMLDialogElement.prototype
  dialogo.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialogo.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const CANCHA = { id: 4, sedeId: 1, tipo: 'PADDLE', costoPorHora: 12000, estado: 'OPERATIVA' }
const turno = (hora: number, disponible = true) => ({
  fechaHoraInicio: `2026-11-12T${hora}:00:00-03:00`,
  fechaHoraFin: `2026-11-12T${hora + 1}:00:00-03:00`,
  disponible,
})
const RESERVA = {
  id: 70,
  canchaId: 4,
  usuarioId: 9,
  fechaHoraInicio: turno(10).fechaHoraInicio,
  fechaHoraFin: turno(10).fechaHoraFin,
  estado: 'CONFIRMADA',
  precioAplicado: 12000,
}

const servicios = {
  sesion: {},
  sedes: { listar: vi.fn() },
  usuarios: { obtener: vi.fn() },
  canchas: { obtener: vi.fn(), consultarDisponibilidad: vi.fn(), crearReserva: vi.fn(), listarReservas: vi.fn() },
}

async function montar(rol: 'SOCIO' | 'RECEPCION') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/canchas', name: 'canchas', component: { render: () => null } },
      { path: '/canchas/:canchaId/turnos', name: 'cancha-turnos', component: { render: () => null } },
    ],
  })
  await router.push('/canchas/4/turnos')
  const pinia = createPinia()
  pinia.state.value.sesion = { usuario: { rol, usuarioId: 9, ...(rol === 'RECEPCION' ? { sedeId: 1 } : {}) }, restaurada: true }
  const wrapper = mount(GrillaTurnosPage, {
    global: {
      plugins: [pinia, router],
      provide: { [ServiciosKey as symbol]: servicios },
      stubs: { ModalPagarReserva: true },
    },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const botonCon = (wrapper: Awaited<ReturnType<typeof montar>>, texto: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(texto))

describe('GrillaTurnosPage', () => {
  beforeEach(() => {
    // Las 8 de la mañana en la sede: los turnos de las 10 y las 11 todavía no empezaron.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-12T08:00:00-03:00'))
    servicios.sedes.listar.mockReset().mockResolvedValue([{ id: 1, nombre: 'Belgrano', direccion: 'x', aforoMaximo: 100 }])
    servicios.usuarios.obtener.mockReset().mockResolvedValue({ id: 30, nombre: 'Carla Pérez' })
    servicios.canchas.obtener.mockReset().mockResolvedValue(CANCHA)
    servicios.canchas.consultarDisponibilidad.mockReset().mockResolvedValue({ items: [turno(10), turno(11, false)], total: 2 })
    servicios.canchas.crearReserva.mockReset().mockResolvedValue(RESERVA)
    servicios.canchas.listarReservas.mockReset().mockResolvedValue({ items: [{ ...RESERVA, id: 71, usuarioId: 30, fechaHoraInicio: turno(11).fechaHoraInicio, fechaHoraFin: turno(11).fechaHoraFin }], total: 1 })
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('muestra la cancha con su sede y precio, y los turnos del día', async () => {
    const wrapper = await montar('SOCIO')

    expect(servicios.canchas.consultarDisponibilidad).toHaveBeenCalledWith(4, '2026-11-12', expect.any(AbortSignal))
    expect(wrapper.get('h1').text()).toContain('#4')
    expect(wrapper.text()).toContain('Belgrano')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
  })

  it('el SOCIO reserva un turno libre: confirma y ve la reserva con la opción de pagar', async () => {
    const wrapper = await montar('SOCIO')
    // Solo el turno libre ofrece "Reservar".
    expect(wrapper.findAll('button').filter((b) => b.text() === 'Reservar')).toHaveLength(1)

    await botonCon(wrapper, 'Reservar')!.trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Confirmar reserva')
    await botonCon(wrapper, 'Confirmar reserva')!.trigger('click')
    await flushPromises()

    expect(servicios.canchas.crearReserva).toHaveBeenCalledWith({
      canchaId: 4,
      usuarioId: 9,
      fechaHoraInicio: turno(10).fechaHoraInicio,
      fechaHoraFin: turno(10).fechaHoraFin,
    })
    expect(wrapper.text()).toContain('Reserva confirmada por')
    expect(botonCon(wrapper, 'Pagar ahora')).toBeDefined()
  })

  it('si otro tomó el turno antes (RN-02), muestra el motivo y vuelve a pedir la grilla', async () => {
    servicios.canchas.crearReserva.mockRejectedValue(
      new ErrorApi(409, 'x', { type: TIPOS_ERROR_CANCHAS.TURNO_OCUPADO, title: 'x', status: 409, detail: 'x' }),
    )
    const wrapper = await montar('SOCIO')
    const consultas = servicios.canchas.consultarDisponibilidad.mock.calls.length

    await botonCon(wrapper, 'Reservar')!.trigger('click')
    await flushPromises()
    await botonCon(wrapper, 'Confirmar reserva')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Ese turno acaba de ser tomado, elegí otro.')
    expect(servicios.canchas.consultarDisponibilidad.mock.calls.length).toBe(consultas + 1)
    expect(wrapper.text()).not.toContain('Reserva confirmada por')
  })

  it('el RECEPCION consulta sin reservar y ve quién reservó cada turno ocupado', async () => {
    const wrapper = await montar('RECEPCION')

    expect(botonCon(wrapper, 'Reservar')).toBeUndefined()
    expect(servicios.canchas.listarReservas).toHaveBeenCalledWith(
      { canchaId: 4, fecha: '2026-11-12', estado: 'CONFIRMADA' },
      1,
      expect.any(Number),
      expect.any(AbortSignal),
    )
    expect(wrapper.text()).toContain('Carla Pérez')
  })

  it('una cancha en mantenimiento no muestra la grilla', async () => {
    servicios.canchas.obtener.mockResolvedValue({ ...CANCHA, estado: 'EN_MANTENIMIENTO' })

    const wrapper = await montar('SOCIO')

    expect(wrapper.text()).toContain('Esta cancha está en mantenimiento')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('si la cancha no carga, lo avisa', async () => {
    servicios.canchas.obtener.mockRejectedValue(new Error('caído'))

    const wrapper = await montar('SOCIO')

    expect(wrapper.text()).toContain('No se pudo cargar la cancha.')
  })
})
