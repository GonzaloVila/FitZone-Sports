import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { limpiarPenalidadCobrada } from '@/compartido/composables/usePenalidadCobrada'
import { ErrorApi } from '@/compartido/http/errores'
import { ServiciosKey } from '@/compartido/servicios'
import DetalleClasePage from './DetalleClasePage.vue'

// RF-07 / RF-08: el detalle de una clase. El socio reserva, se anota en la lista de espera si no hay cupo y cancela (con
// penalidad si faltan menos de 2 horas); el personal ve inscriptos y lista de espera.
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

// "Ahora" es el 12/11 a las 8:00 en la sede. La clase de las 19:00 está dentro de la ventana de reserva y lejos de la
// penalidad; la de las 9:00 empieza en menos de 2 horas.
const AHORA = new Date('2026-11-12T08:00:00-03:00')
const clase = (cambios: Record<string, unknown> = {}) => ({
  id: 30,
  sedeId: 1,
  tipo: 'Spinning',
  instructor: 'Laura',
  horarioInicio: '2026-11-12T19:00:00-03:00',
  horarioFin: '2026-11-12T20:00:00-03:00',
  capacidad: 20,
  reservasConfirmadas: 5,
  cupoDisponible: 15,
  ...cambios,
})
const RESERVA = { id: 80, claseId: 30, socioId: 12, estado: 'CONFIRMADA' }
const vacia = { items: [], total: 0 }

const servicios = {
  sesion: {},
  sedes: { listar: vi.fn() },
  pagos: { listar: vi.fn(), descargarComprobante: vi.fn() },
  clases: {
    obtener: vi.fn(),
    listarReservas: vi.fn(),
    listarEsperas: vi.fn(),
    listarEsperaDeClase: vi.fn(),
    listarInscriptos: vi.fn(),
    reservar: vi.fn(),
    cancelarReserva: vi.fn(),
    anotarseEnEspera: vi.fn(),
    confirmarEspera: vi.fn(),
    salirDeEspera: vi.fn(),
  },
}

async function montar(rol: 'SOCIO' | 'RECEPCION', claseId = '30') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/clases', name: 'clases', component: { render: () => null } },
      { path: '/clases/:claseId', name: 'clase-detalle', component: { render: () => null } },
    ],
  })
  await router.push(`/clases/${claseId}`)
  const pinia = createPinia()
  pinia.state.value.sesion = {
    usuario: rol === 'SOCIO' ? { rol, usuarioId: 9, socioId: 12 } : { rol, usuarioId: 3, sedeId: 1 },
    restaurada: true,
  }
  const wrapper = mount(DetalleClasePage, {
    global: { plugins: [pinia, router], provide: { [ServiciosKey as symbol]: servicios } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const botonCon = (wrapper: Awaited<ReturnType<typeof montar>>, texto: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(texto))

describe('DetalleClasePage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(AHORA)
    limpiarPenalidadCobrada()
    servicios.sedes.listar.mockReset().mockResolvedValue([{ id: 1, nombre: 'Belgrano', direccion: 'x', aforoMaximo: 100 }])
    servicios.pagos.listar.mockReset().mockResolvedValue(vacia)
    for (const fn of Object.values(servicios.clases)) fn.mockReset().mockResolvedValue(vacia)
    servicios.clases.obtener.mockResolvedValue(clase())
    servicios.clases.reservar.mockResolvedValue(RESERVA)
    servicios.clases.cancelarReserva.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('muestra la clase con su sede, sin datos del personal para el socio', async () => {
    const wrapper = await montar('SOCIO')

    expect(wrapper.get('h1').text()).toBe('Spinning')
    expect(wrapper.text()).toContain('Belgrano')
    expect(wrapper.text()).not.toContain('Inscriptos')
    expect(servicios.clases.listarInscriptos).not.toHaveBeenCalled()
  })

  it('el socio reserva un cupo libre y ve la confirmación', async () => {
    const wrapper = await montar('SOCIO')

    await botonCon(wrapper, 'Reservar')!.trigger('click')
    await flushPromises()

    expect(servicios.clases.reservar).toHaveBeenCalledWith(30, 12)
    expect(wrapper.text()).toContain('Reserva confirmada. ¡Nos vemos en la clase!')
  })

  it('sin cupo, el socio se anota en la lista de espera (RF-08)', async () => {
    servicios.clases.obtener.mockResolvedValue(clase({ reservasConfirmadas: 20, cupoDisponible: 0 }))
    const wrapper = await montar('SOCIO')
    expect(botonCon(wrapper, 'Reservar')).toBeUndefined()

    await botonCon(wrapper, 'Anotarme en lista de espera')!.trigger('click')
    await flushPromises()

    expect(servicios.clases.anotarseEnEspera).toHaveBeenCalledWith(30, 12)
    expect(wrapper.text()).toContain('Quedaste anotado en la lista de espera.')
  })

  it('el socio con reserva la cancela desde el modal, sin penalidad si faltan más de 2 horas', async () => {
    servicios.clases.listarReservas.mockResolvedValue({ items: [RESERVA], total: 1 })
    const wrapper = await montar('SOCIO')
    expect(wrapper.text()).toContain('Tenés un cupo reservado')

    await botonCon(wrapper, 'Cancelar reserva')!.trigger('click')
    await flushPromises()
    const confirmar = wrapper.findAll('dialog button').find((b) => b.text() === 'Cancelar reserva')!
    await confirmar.trigger('click')
    await flushPromises()

    expect(servicios.clases.cancelarReserva).toHaveBeenCalledWith(80)
    expect(wrapper.text()).toContain('Reserva cancelada.')
  })

  it('cancelar a menos de 2 horas cobra la penalidad y la muestra con su comprobante', async () => {
    servicios.clases.obtener.mockResolvedValue(
      clase({ horarioInicio: '2026-11-12T09:00:00-03:00', horarioFin: '2026-11-12T10:00:00-03:00' }),
    )
    servicios.clases.listarReservas.mockResolvedValue({ items: [RESERVA], total: 1 })
    servicios.pagos.listar.mockResolvedValue({ items: [{ id: 500, monto: 3000 }], total: 1 })
    const wrapper = await montar('SOCIO')

    await botonCon(wrapper, 'Cancelar reserva')!.trigger('click')
    await flushPromises()
    await wrapper.findAll('dialog button').find((b) => b.text() === 'Cancelar y pagar penalidad')!.trigger('click')
    await flushPromises()

    expect(servicios.pagos.listar).toHaveBeenCalledWith({ reservaClaseId: 80 }, 1, 1)
    expect(botonCon(wrapper, 'Descargar comprobante')).toBeDefined()
  })

  it('el personal ve los inscriptos y la lista de espera, sin acciones de socio', async () => {
    const wrapper = await montar('RECEPCION')

    expect(servicios.clases.listarInscriptos).toHaveBeenCalledWith(30, 1, expect.any(Number), expect.any(AbortSignal))
    expect(servicios.clases.listarEsperaDeClase).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Inscriptos')
    expect(wrapper.text()).toContain('Lista de espera')
    expect(botonCon(wrapper, 'Reservar')).toBeUndefined()
  })

  it('un id inválido se trata como clase inexistente sin consultar la API', async () => {
    const wrapper = await montar('SOCIO', 'abc')

    expect(servicios.clases.obtener).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('La clase que buscás no existe.')
  })

  it('una clase que no existe (404) lo dice', async () => {
    servicios.clases.obtener.mockRejectedValue(new ErrorApi(404, 'No existe'))

    const wrapper = await montar('SOCIO', '999')

    expect(wrapper.text()).toContain('La clase que buscás no existe.')
  })
})
