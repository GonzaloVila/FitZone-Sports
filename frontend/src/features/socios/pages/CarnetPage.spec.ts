import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import * as OTPAuth from 'otpauth'
import { createPinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { ErrorApi } from '@/compartido/http/errores'
import { ServiciosKey } from '@/compartido/servicios'
import CarnetPage from './CarnetPage.vue'

// RF-04: el carnet del socio con su QR de acceso dinámico. Generar el QR reemplaza el secreto TOTP del socio (por eso pide
// confirmación); el código de 6 dígitos se calcula en el navegador y rota cada 30 segundos. El QR se reemplaza por un stub
// que deja ver el texto que codifica.
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

const SECRETO = 'JBSWY3DPEHPK3PXP'
const QR_URI = `otpauth://totp/FitZone:ana@fitzone.test?secret=${SECRETO}&issuer=FitZone`
const QrFalso = defineComponent({ props: { texto: String }, setup: (p) => () => h('div', { class: 'qr-falso' }, p.texto) })

const servicios = {
  sesion: {},
  sedes: { listar: vi.fn() },
  usuarios: { obtener: vi.fn() },
  socios: { obtener: vi.fn(), obtenerMembresia: vi.fn(), registrarQr: vi.fn() },
}

async function montar(usuario: Record<string, unknown> = { rol: 'SOCIO', usuarioId: 50, socioId: 12 }) {
  const pinia = createPinia()
  pinia.state.value.sesion = { usuario, restaurada: true }
  const wrapper = mount(CarnetPage, {
    global: { plugins: [pinia], provide: { [ServiciosKey as symbol]: servicios }, stubs: { QrFz: QrFalso } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const botonCon = (wrapper: Awaited<ReturnType<typeof montar>>, texto: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(texto))

async function generar(wrapper: Awaited<ReturnType<typeof montar>>) {
  await botonCon(wrapper, 'Activar o regenerar QR de acceso')!.trigger('click')
  await flushPromises()
  await botonCon(wrapper, 'Generar código nuevo')!.trigger('click')
  await flushPromises()
}

const totpEn = (instante: number) =>
  new OTPAuth.TOTP({ secret: SECRETO, algorithm: 'SHA1', digits: 6, period: 30 }).generate({ timestamp: instante })

describe('CarnetPage', () => {
  beforeEach(() => {
    // Las 10:00:05: quedan 25 segundos del período TOTP actual.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-11-10T10:00:05Z'))
    servicios.sedes.listar.mockReset().mockResolvedValue([{ id: 1, nombre: 'Belgrano', direccion: 'x', aforoMaximo: 100 }])
    servicios.socios.obtener.mockReset().mockResolvedValue({
      id: 12,
      usuarioId: 50,
      sedeOrigenId: 1,
      fechaAlta: '2026-01-15T10:00:00-03:00',
      nombre: 'Ana Socia',
      email: 'ana@fitzone.test',
    })
    servicios.socios.obtenerMembresia.mockReset().mockResolvedValue({
      id: 88,
      socioId: 12,
      plan: 'ANUAL',
      estado: 'ACTIVA',
      fechaInicio: '2026-01-15',
      fechaFin: '2027-01-15',
      renuevaAutomatica: true,
    })
    servicios.usuarios.obtener.mockReset().mockResolvedValue({ id: 50, nombre: 'Ana Socia', dni: '30111222', email: 'ana@fitzone.test', rol: 'SOCIO' })
    servicios.socios.registrarQr.mockReset().mockResolvedValue({ qrUri: QR_URI, mensaje: 'Escaneá el código en recepción.' })
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('muestra la ficha del socio con su plan y sede, sin QR hasta que lo pida', async () => {
    const wrapper = await montar()

    expect(wrapper.text()).toContain('Ana Socia')
    expect(wrapper.text()).toContain('Belgrano')
    expect(wrapper.find('.qr-falso').exists()).toBe(false)
    // Cargar la pantalla nunca regenera el secreto.
    expect(servicios.socios.registrarQr).not.toHaveBeenCalled()
  })

  it('al confirmar genera el QR: el código TOTP es el del secreto y el QR lleva socioId y código', async () => {
    const wrapper = await montar()

    await generar(wrapper)

    const codigo = totpEn(Date.now())
    expect(servicios.socios.registrarQr).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.carnet-pagina__totp-codigo').text()).toBe(codigo)
    expect(JSON.parse(wrapper.get('.qr-falso').text())).toEqual({ socioId: 12, codigoTotp: codigo })
    expect(wrapper.text()).toContain('Se actualiza en 25s')
    expect(wrapper.get('.carnet-pagina__secreto').text()).toBe(SECRETO)
    expect(wrapper.text()).toContain('Escaneá el código en recepción.')
  })

  it('el código rota al empezar el período siguiente', async () => {
    const wrapper = await montar()
    await generar(wrapper)
    const primero = wrapper.get('.carnet-pagina__totp-codigo').text()

    await vi.advanceTimersByTimeAsync(25_000)

    const segundo = wrapper.get('.carnet-pagina__totp-codigo').text()
    expect(segundo).toBe(totpEn(Date.now()))
    expect(segundo).not.toBe(primero)
    expect(wrapper.text()).toContain('Se actualiza en 30s')
  })

  it('"Ocultar código" saca el QR y el secreto de la pantalla', async () => {
    const wrapper = await montar()
    await generar(wrapper)

    await botonCon(wrapper, 'Ocultar código')!.trigger('click')

    expect(wrapper.find('.qr-falso').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(SECRETO)
  })

  it('el secreto no queda guardado en el navegador', async () => {
    const wrapper = await montar()
    await generar(wrapper)
    expect(wrapper.find('.qr-falso').exists()).toBe(true)

    expect(JSON.stringify({ ...localStorage })).not.toContain(SECRETO)
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(SECRETO)
  })

  it.each([
    [401, 'Tu sesión venció. Volvé a ingresar para generar el código.'],
    [403, 'Solo los socios pueden generar el código de acceso.'],
    [404, 'No se encontró tu registro de socio.'],
  ])('si el servidor responde %i, el modal sigue abierto con el motivo', async (status, mensaje) => {
    servicios.socios.registrarQr.mockRejectedValue(new ErrorApi(status, 'x'))
    const wrapper = await montar()

    await generar(wrapper)

    expect(wrapper.find('dialog[open]').exists()).toBe(true)
    expect(wrapper.text()).toContain(mensaje)
    expect(wrapper.find('.qr-falso').exists()).toBe(false)
  })

  it('una sesión sin socio no tiene carnet', async () => {
    const wrapper = await montar({ rol: 'SOCIO', usuarioId: 50 })

    expect(wrapper.text()).toContain('Tu sesión no tiene un socio asociado')
    expect(servicios.socios.obtener).not.toHaveBeenCalled()
  })

  it('un socio que no existe lo dice', async () => {
    servicios.socios.obtener.mockRejectedValue(new ErrorApi(404, 'x'))

    const wrapper = await montar()

    expect(wrapper.text()).toContain('No se encontró tu registro de socio.')
  })
})
