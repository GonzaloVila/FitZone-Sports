import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorApi } from '@/compartido/http/errores'
import { ServiciosKey } from '@/compartido/servicios'
import TablaPagos from '../components/TablaPagos.vue'
import MisPagosPage from './MisPagosPage.vue'
import PagosPage from './PagosPage.vue'

// RF-13 / RF-14: "Pagos" (el personal ve todos, baja comprobantes y anula) y "Mis pagos" (cada uno ve los suyos, sin anular).
// Las dos pantallas comparten ListaPagos; las acciones de la fila se disparan desde la tabla.
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

const pago = (id: number, estado = 'APROBADO') => ({
  id,
  usuarioId: 9,
  concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: 70 },
  monto: 12000,
  moneda: 'ARS',
  estado,
  fechaPago: '2026-11-10T12:00:00Z',
})

const servicios = {
  sesion: {},
  pagos: { listar: vi.fn(), anular: vi.fn(), descargarComprobante: vi.fn() },
}

async function montar(pagina: typeof PagosPage | typeof MisPagosPage, usuario: Record<string, unknown> = { rol: 'GERENTE', usuarioId: 3 }) {
  const pinia = createPinia()
  pinia.state.value.sesion = { usuario, restaurada: true }
  const wrapper = mount(pagina, {
    global: { plugins: [pinia], provide: { [ServiciosKey as symbol]: servicios } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const filtrosPedidos = () => servicios.pagos.listar.mock.lastCall![0]

describe('PagosPage (personal)', () => {
  beforeEach(() => {
    servicios.pagos.listar.mockReset().mockResolvedValue({ items: [pago(500), pago(501)], total: 2 })
    servicios.pagos.anular.mockReset().mockResolvedValue(undefined)
    servicios.pagos.descargarComprobante.mockReset().mockResolvedValue(new Blob(['%PDF']))
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }))
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('lista todos los pagos, sin acotar a un usuario', async () => {
    const wrapper = await montar(PagosPage)

    expect(wrapper.get('h1').text()).toBe('Pagos')
    expect(wrapper.get('header').text()).toContain('2 pagos')
    expect(filtrosPedidos().usuarioId).toBeUndefined()
    expect(wrapper.findComponent(TablaPagos).props('puedeAnular')).toBe(true)
  })

  it('anular pide confirmación, anula y recarga la lista', async () => {
    const wrapper = await montar(PagosPage)
    const consultas = servicios.pagos.listar.mock.calls.length

    wrapper.findComponent(TablaPagos).vm.$emit('anular', pago(500))
    await flushPromises()
    await wrapper.findAll('dialog button').find((b) => b.text().includes('Anular pago'))!.trigger('click')
    await flushPromises()

    expect(servicios.pagos.anular).toHaveBeenCalledWith(500)
    expect(servicios.pagos.listar.mock.calls.length).toBe(consultas + 1)
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
  })

  it('si el pago no se puede anular (409), el modal sigue abierto con el motivo', async () => {
    servicios.pagos.anular.mockRejectedValue(new ErrorApi(409, 'ya estaba anulado'))
    const wrapper = await montar(PagosPage)

    wrapper.findComponent(TablaPagos).vm.$emit('anular', pago(500))
    await flushPromises()
    await wrapper.findAll('dialog button').find((b) => b.text().includes('Anular pago'))!.trigger('click')
    await flushPromises()

    expect(wrapper.find('dialog[open]').exists()).toBe(true)
    expect(wrapper.text()).toContain('El pago no se puede anular: ya estaba anulado')
  })

  it('el comprobante se descarga como PDF con el número de pago', async () => {
    const wrapper = await montar(PagosPage)
    const clicks: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download)
    })

    wrapper.findComponent(TablaPagos).vm.$emit('comprobante', pago(501))
    await flushPromises()

    expect(servicios.pagos.descargarComprobante).toHaveBeenCalledWith(501)
    expect(clicks).toEqual(['comprobante-501.pdf'])
  })

  it('si la descarga falla, lo avisa', async () => {
    servicios.pagos.descargarComprobante.mockRejectedValue(new Error('caído'))
    const wrapper = await montar(PagosPage)

    wrapper.findComponent(TablaPagos).vm.$emit('comprobante', pago(501))
    await flushPromises()

    expect(wrapper.text()).toContain('No se pudo descargar el PDF.')
  })
})

describe('MisPagosPage (socio o externo)', () => {
  beforeEach(() => {
    servicios.pagos.listar.mockReset().mockResolvedValue({ items: [], total: 0 })
  })

  it('acota la lista a los pagos del usuario de la sesión y no permite anular', async () => {
    servicios.pagos.listar.mockResolvedValue({ items: [pago(500)], total: 1 })

    const wrapper = await montar(MisPagosPage, { rol: 'SOCIO', usuarioId: 9, socioId: 12 })

    expect(wrapper.get('h1').text()).toBe('Mis pagos')
    expect(filtrosPedidos().usuarioId).toBe(9)
    expect(wrapper.findComponent(TablaPagos).props('puedeAnular')).toBe(false)
    expect(wrapper.find('input[name="usuarioId"]').exists()).toBe(false)
  })

  it('sin pagos muestra el texto propio de la pantalla', async () => {
    const wrapper = await montar(MisPagosPage, { rol: 'EXTERNO', usuarioId: 9 })

    expect(wrapper.text()).toContain('Todavía no tenés pagos.')
  })
})
