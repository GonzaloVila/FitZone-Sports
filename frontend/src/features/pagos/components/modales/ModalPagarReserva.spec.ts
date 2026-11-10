import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ServiciosKey } from '@/compartido/servicios'
import ModalPagarReserva from './ModalPagarReserva.vue'

// RF-13: el pago de una reserva de cancha desde la interfaz. Se elige el medio (demo), se paga con una Idempotency-Key y se
// muestra el resultado; con el pago aprobado se puede bajar el comprobante y, al cerrar, la pantalla se entera.
enableAutoUnmount(afterEach)

beforeAll(() => {
  const dialogo = HTMLDialogElement.prototype
  dialogo.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialogo.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const RESERVA = {
  id: 70,
  canchaId: 4,
  usuarioId: 9,
  fechaHoraInicio: '2026-11-12T10:00:00-03:00',
  fechaHoraFin: '2026-11-12T11:00:00-03:00',
  estado: 'CONFIRMADA',
  precioAplicado: 12000,
}
const pago = (estado: string) => ({
  id: 500,
  usuarioId: 9,
  concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: 70 },
  monto: 12000,
  moneda: 'ARS',
  estado,
  fechaPago: '2026-11-10T12:00:00Z',
})

const servicios = { pagos: { procesar: vi.fn(), listar: vi.fn(), descargarComprobante: vi.fn() } }

async function montar() {
  const wrapper = mount(ModalPagarReserva, {
    props: { abierto: false, reserva: RESERVA as never, nombreCancha: 'Pádel #4' },
    global: { provide: { [ServiciosKey as symbol]: servicios } },
    attachTo: document.body,
  })
  await wrapper.setProps({ abierto: true })
  await flushPromises()
  return wrapper
}

async function pagarCon(wrapper: Awaited<ReturnType<typeof montar>>, medio: string) {
  if (medio) await wrapper.get('select[name="medio"]').setValue(medio)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

const botonCon = (wrapper: Awaited<ReturnType<typeof montar>>, texto: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(texto))

describe('ModalPagarReserva', () => {
  beforeEach(() => {
    servicios.pagos.procesar.mockReset().mockResolvedValue(pago('APROBADO'))
    servicios.pagos.listar.mockReset().mockResolvedValue({ items: [], total: 0 })
    servicios.pagos.descargarComprobante.mockReset().mockResolvedValue(new Blob(['%PDF']))
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }))
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('muestra el resumen de la reserva con la cancha y el monto', async () => {
    const wrapper = await montar()

    expect(wrapper.text()).toContain('Pádel #4')
    expect(wrapper.text()).toMatch(/12\.000/)
  })

  it('sin medio elegido no cobra y lo pide', async () => {
    const wrapper = await montar()

    await pagarCon(wrapper, '')

    expect(servicios.pagos.procesar).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Elegí un medio de pago.')
  })

  it('con tarjeta aprobada cobra con clave de idempotencia, muestra el resultado y permite bajar el comprobante', async () => {
    const wrapper = await montar()

    await pagarCon(wrapper, 'aprobada')

    const [cuerpo, clave] = servicios.pagos.procesar.mock.calls[0]!
    expect(cuerpo).toEqual({ concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: 70 }, token: 'tok_aprobado_demo', moneda: 'ARS' })
    expect(clave).toMatch(/^[0-9a-f-]{36}$/)
    expect(wrapper.text()).toContain('Pago aprobado por')

    await botonCon(wrapper, 'Descargar comprobante')!.trigger('click')
    await flushPromises()
    expect(servicios.pagos.descargarComprobante).toHaveBeenCalledWith(500)
  })

  it('al cerrar después de un pago aprobado avisa a la pantalla', async () => {
    const wrapper = await montar()
    await pagarCon(wrapper, 'aprobada')

    await botonCon(wrapper, 'Cerrar')!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('pagado')).toHaveLength(1)
  })

  it('con tarjeta rechazada muestra el rechazo, sin comprobante y sin avisar al cerrar', async () => {
    servicios.pagos.procesar.mockResolvedValue(pago('RECHAZADO'))
    const wrapper = await montar()

    await pagarCon(wrapper, 'rechazada')

    expect(servicios.pagos.procesar.mock.calls[0]![0].token).toBe('tok_rechazado_demo')
    expect(wrapper.text()).toContain('Pago rechazado por')
    expect(botonCon(wrapper, 'Descargar comprobante')).toBeUndefined()

    await botonCon(wrapper, 'Cerrar')!.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('pagado')).toBeUndefined()
  })

  it('al reabrir arranca limpio, sin el resultado anterior', async () => {
    const wrapper = await montar()
    await pagarCon(wrapper, 'aprobada')

    await wrapper.setProps({ abierto: false })
    await wrapper.setProps({ abierto: true })
    await flushPromises()

    expect(wrapper.find('select[name="medio"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Pago aprobado por')
  })
})
