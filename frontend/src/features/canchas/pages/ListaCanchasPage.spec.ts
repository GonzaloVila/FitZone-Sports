import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ServiciosKey } from '@/compartido/servicios'
import ListaCanchasPage from './ListaCanchasPage.vue'

// RF-09 / RF-11: la pantalla de canchas. El GERENTE administra (alta y edición); SOCIO y EXTERNO reservan y tienen la
// vista "Mis reservas"; el RECEPCION consulta. Los modales de alta, edición y pago se reemplazan por stubs.
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

const cancha = (id: number, sedeId = 1) => ({ id, sedeId, tipo: 'PADDLE', costoPorHora: 12000, estado: 'OPERATIVA' })

const servicios = {
  sesion: {},
  sedes: { listar: vi.fn() },
  canchas: { buscar: vi.fn(), listarReservas: vi.fn(), cancelarReserva: vi.fn() },
  pagos: { listar: vi.fn() },
}

let router: ReturnType<typeof createRouter>

async function montar(rol: 'GERENTE' | 'SOCIO' | 'RECEPCION', query: Record<string, string> = {}) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/canchas', name: 'canchas', component: { render: () => null } },
      { path: '/canchas/:canchaId/turnos', name: 'cancha-turnos', component: { render: () => null } },
    ],
  })
  await router.push({ path: '/canchas', query })
  const pinia = createPinia()
  pinia.state.value.sesion = { usuario: { rol, usuarioId: 9, ...(rol === 'RECEPCION' ? { sedeId: 2 } : {}) }, restaurada: true }
  const wrapper = mount(ListaCanchasPage, {
    global: {
      plugins: [pinia, router],
      provide: { [ServiciosKey as symbol]: servicios },
      stubs: { ModalNuevaCancha: true, ModalEditarCancha: true, ModalPagarReserva: true },
    },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('ListaCanchasPage', () => {
  beforeEach(() => {
    servicios.sedes.listar.mockReset().mockResolvedValue([
      { id: 1, nombre: 'Belgrano', direccion: 'x', aforoMaximo: 100 },
      { id: 2, nombre: 'Palermo', direccion: 'y', aforoMaximo: 50 },
    ])
    servicios.canchas.buscar.mockReset().mockResolvedValue({ items: [cancha(4), cancha(5, 2)], total: 2 })
    servicios.canchas.listarReservas.mockReset().mockResolvedValue({ items: [], total: 0 })
    servicios.canchas.cancelarReserva.mockReset()
    servicios.pagos.listar.mockReset().mockResolvedValue({ items: [], total: 0 })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('el GERENTE ve todas las canchas y puede cargar una nueva, sin la vista de reservas', async () => {
    const wrapper = await montar('GERENTE')

    expect(wrapper.get('header').text()).toContain('2 canchas')
    expect(wrapper.text()).toContain('Nueva cancha')
    expect(wrapper.find('input[name="vista-canchas"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Belgrano')
    expect(wrapper.text()).toContain('Palermo')
  })

  it('el SOCIO no administra, pero tiene la vista "Mis reservas" con sus reservas', async () => {
    const wrapper = await montar('SOCIO')
    expect(wrapper.text()).not.toContain('Nueva cancha')

    await wrapper.get('input[name="vista-canchas"][value="mis-reservas"]').trigger('change')
    await flushPromises()

    expect(router.currentRoute.value.query.vista).toBe('mis-reservas')
    expect(servicios.canchas.listarReservas).toHaveBeenCalledWith(
      { usuarioId: 9, estado: undefined },
      1,
      expect.any(Number),
      expect.any(AbortSignal),
    )
    expect(wrapper.text()).toContain('Tus reservas de cancha')
  })

  it('al volver de "Mis reservas" a "Canchas" recarga la lista', async () => {
    const wrapper = await montar('SOCIO', { vista: 'mis-reservas' })
    const consultas = servicios.canchas.buscar.mock.calls.length

    await wrapper.get('input[name="vista-canchas"][value="canchas"]').trigger('change')
    await flushPromises()

    expect(servicios.canchas.buscar.mock.calls.length).toBeGreaterThan(consultas)
    expect(wrapper.get('header').text()).toContain('2 canchas')
  })

  it('sin resultados lo dice y sugiere cambiar los filtros', async () => {
    servicios.canchas.buscar.mockResolvedValue({ items: [], total: 0 })

    const wrapper = await montar('SOCIO')

    expect(wrapper.text()).toContain('No se encontraron canchas con los filtros elegidos.')
  })

  it('si la búsqueda falla, muestra el error', async () => {
    servicios.canchas.buscar.mockRejectedValue(new Error('caído'))

    const wrapper = await montar('GERENTE')

    expect(wrapper.text()).toContain('No se pudieron cargar las canchas.')
    expect(wrapper.text()).not.toContain('No se encontraron canchas')
  })
})
