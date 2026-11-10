import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ServiciosKey } from '@/compartido/servicios'
import ModalRegistrarIngreso from './ModalRegistrarIngreso.vue'

// RF-04 / RNF-01: el modal con el que el puesto de control valida un ingreso. Se prueba desde la interfaz: se completa
// el formulario, se envía y se mira el resultado que ve el recepcionista.
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

const SEDES = [{ id: 1, nombre: 'Belgrano', direccion: 'Cabildo 100', aforoMaximo: 100 }]
const INGRESO = { id: 40, sedeId: 1, socioId: 12, nombre: 'Ana Socia', dni: '30000001', fechaHoraIngreso: '2026-11-10T12:00:00Z', validadoOffline: false }

const servicios = { sesion: {}, acceso: { registrarIngreso: vi.fn() } }

async function montar(props: Record<string, unknown> = {}) {
  const pinia = createPinia()
  pinia.state.value.sesion = { usuario: { rol: 'RECEPCION', usuarioId: 9, sedeId: 1 }, restaurada: true }
  const wrapper = mount(ModalRegistrarIngreso, {
    props: { abierto: false, sedes: SEDES, cargandoSedes: false, ...props },
    global: {
      plugins: [pinia],
      provide: { [ServiciosKey as symbol]: servicios },
      stubs: { ModalEscanearQr: true },
    },
    attachTo: document.body,
  })
  await wrapper.setProps({ abierto: true })
  await flushPromises()
  return wrapper
}

async function validar(wrapper: Awaited<ReturnType<typeof montar>>, socioId: string, codigo = '123456') {
  await wrapper.get('input[name="socioId"]').setValue(socioId)
  await wrapper.get('input[name="codigoTotp"]').setValue(codigo)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('ModalRegistrarIngreso', () => {
  beforeEach(() => {
    servicios.acceso.registrarIngreso.mockReset().mockResolvedValue(INGRESO)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('con red valida contra la API, muestra "Ingreso permitido" y avisa a la pantalla', async () => {
    const wrapper = await montar({ enLinea: true })

    await validar(wrapper, '12')

    expect(servicios.acceso.registrarIngreso).toHaveBeenCalledWith({ sedeId: 1, socioId: 12, codigoTotp: '123456' })
    expect(wrapper.text()).toContain('Ingreso permitido')
    expect(wrapper.emitted('registrado')).toEqual([[INGRESO]])
    // Listo para el siguiente: ID y código vacíos.
    expect((wrapper.get('input[name="socioId"]').element as HTMLInputElement).value).toBe('')
  })

  it('sin red encola el ingreso y lo informa como registrado sin conexión', async () => {
    const alEncolarOffline = vi.fn()
    const wrapper = await montar({ enLinea: false, alEncolarOffline, bloqueoOffline: () => null })

    await validar(wrapper, '12')

    expect(servicios.acceso.registrarIngreso).not.toHaveBeenCalled()
    expect(alEncolarOffline).toHaveBeenCalledWith({ socioId: 12, codigoTotp: '123456', tipo: 'ingreso' })
    expect(wrapper.text()).toContain('Ingreso registrado sin conexión')
  })

  it('sin red, un socio de la lista local de inhabilitados se rechaza en el momento y no se encola', async () => {
    const alEncolarOffline = vi.fn()
    const bloqueoOffline = vi.fn().mockReturnValue({ motivo: 'VENCIDA', desde: '2026-11-01T15:00:00Z' })
    const wrapper = await montar({ enLinea: false, alEncolarOffline, bloqueoOffline })

    await validar(wrapper, '150')

    expect(bloqueoOffline).toHaveBeenCalledWith(150)
    expect(alEncolarOffline).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Ingreso denegado')
    expect(wrapper.text()).toContain('La membresía no está vigente o está suspendida.')
    // El ID se conserva para poder corregirlo o reintentar.
    expect((wrapper.get('input[name="socioId"]').element as HTMLInputElement).value).toBe('150')
  })

  it('con datos incompletos no valida', async () => {
    const wrapper = await montar({ enLinea: true })

    await validar(wrapper, '', '')

    expect(servicios.acceso.registrarIngreso).not.toHaveBeenCalled()
    expect(wrapper.emitted('registrado')).toBeUndefined()
  })
})
