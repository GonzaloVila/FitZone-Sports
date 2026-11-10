import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ServiciosKey } from '@/compartido/servicios'
import AgendaClasesPage from './AgendaClasesPage.vue'

// RF-07: la agenda de clases. El personal crea clases; el socio ve cuáles ya reservó y tiene la vista "Mis clases" con sus
// reservas y esperas. El modal de alta se reemplaza por un stub (useAltaClase tiene su propio spec).
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

const clase = (id: number, tipo: string) => ({
  id,
  sedeId: 1,
  tipo,
  instructor: 'Laura',
  horarioInicio: '2026-11-12T19:00:00-03:00',
  horarioFin: '2026-11-12T20:00:00-03:00',
  capacidad: 20,
  reservasConfirmadas: 5,
  cupoDisponible: 15,
})
const vacia = { items: [], total: 0 }

const servicios = {
  sesion: {},
  sedes: { listar: vi.fn() },
  pagos: { listar: vi.fn(), descargarComprobante: vi.fn() },
  clases: {
    listar: vi.fn(),
    obtener: vi.fn(),
    listarReservas: vi.fn(),
    listarEsperas: vi.fn(),
    listarEsperaDeClase: vi.fn(),
    cancelarReserva: vi.fn(),
    confirmarEspera: vi.fn(),
    salirDeEspera: vi.fn(),
  },
}

let router: ReturnType<typeof createRouter>

async function montar(rol: 'SOCIO' | 'GERENTE', query: Record<string, string> = {}) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/clases', name: 'clases', component: { render: () => null } },
      { path: '/clases/:claseId', name: 'clase-detalle', component: { render: () => null } },
    ],
  })
  await router.push({ path: '/clases', query })
  const pinia = createPinia()
  pinia.state.value.sesion = {
    usuario: rol === 'SOCIO' ? { rol, usuarioId: 9, socioId: 12 } : { rol, usuarioId: 3 },
    restaurada: true,
  }
  const wrapper = mount(AgendaClasesPage, {
    global: {
      plugins: [pinia, router],
      provide: { [ServiciosKey as symbol]: servicios },
      stubs: { ModalNuevaClase: true },
    },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('AgendaClasesPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-12T08:00:00-03:00'))
    servicios.sedes.listar.mockReset().mockResolvedValue([{ id: 1, nombre: 'Belgrano', direccion: 'x', aforoMaximo: 100 }])
    servicios.pagos.listar.mockReset().mockResolvedValue(vacia)
    for (const fn of Object.values(servicios.clases)) fn.mockReset().mockResolvedValue(vacia)
    servicios.clases.listar.mockResolvedValue({ items: [clase(30, 'Spinning'), clase(31, 'Yoga')], total: 2 })
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('el GERENTE ve la agenda y puede crear clases, sin la vista "Mis clases"', async () => {
    const wrapper = await montar('GERENTE')

    expect(wrapper.get('header').text()).toContain('2 clases')
    expect(wrapper.text()).toContain('Spinning')
    expect(wrapper.text()).toContain('Yoga')
    expect(wrapper.text()).toContain('Nueva clase')
    expect(wrapper.find('input[name="vista-clases"]').exists()).toBe(false)
    // El personal no pide las marcas del socio.
    expect(servicios.clases.listarReservas).not.toHaveBeenCalled()
  })

  it('el socio no crea clases y la agenda le marca lo que ya reservó', async () => {
    servicios.clases.listarReservas.mockResolvedValue({ items: [{ id: 80, claseId: 30, socioId: 12, estado: 'CONFIRMADA' }], total: 1 })

    const wrapper = await montar('SOCIO')

    expect(wrapper.text()).not.toContain('Nueva clase')
    expect(servicios.clases.listarReservas).toHaveBeenCalledWith(
      { socioId: 12, estado: 'CONFIRMADA' },
      1,
      expect.any(Number),
      expect.any(AbortSignal),
    )
  })

  it('el socio pasa a "Mis clases" y se consultan sus reservas y esperas', async () => {
    const wrapper = await montar('SOCIO')
    servicios.clases.listarReservas.mockClear()

    await wrapper.get('input[name="vista-clases"][value="mis-clases"]').trigger('change')
    await flushPromises()

    expect(router.currentRoute.value.query.vista).toBe('mis-clases')
    expect(wrapper.text()).toContain('Tus reservas y tu lista de espera.')
    expect(servicios.clases.listarReservas).toHaveBeenCalledWith({ socioId: 12 }, 1, expect.any(Number), expect.any(AbortSignal))
    expect(servicios.clases.listarEsperas).toHaveBeenCalledWith({ socioId: 12 }, 1, expect.any(Number), expect.any(AbortSignal))
  })

  it('sin clases para los filtros lo dice', async () => {
    servicios.clases.listar.mockResolvedValue(vacia)

    const wrapper = await montar('GERENTE')

    expect(wrapper.text()).toContain('No se encontraron clases con los filtros elegidos.')
  })

  it('si la agenda no carga, muestra el error', async () => {
    servicios.clases.listar.mockRejectedValue(new Error('caído'))

    const wrapper = await montar('GERENTE')

    expect(wrapper.text()).not.toContain('No se encontraron clases')
    expect(wrapper.text()).toContain('No se pudo cargar la agenda de clases.')
  })
})
