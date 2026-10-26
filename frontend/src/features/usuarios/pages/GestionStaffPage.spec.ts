import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiciosKey } from '@/compartido/servicios'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import type { Usuario } from '../services/servicioUsuarios'
import GestionStaffPage from './GestionStaffPage.vue'

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

const servicios = {
  usuarios: {
    listar: vi.fn(),
    listarTodosPorRol: vi.fn(),
    crear: vi.fn(),
  },
  sedes: { listar: vi.fn() },
}

const sede = (id: number): Sede => ({ id, nombre: `Sede ${id}`, direccion: '', aforoMaximo: 100 })

const usuario = (parcial: Partial<Usuario>): Usuario => ({
  id: 10,
  rol: 'RECEPCION',
  dni: '35123456',
  nombre: 'Ana Gómez',
  email: 'ana@fitzone.com.ar',
  ...parcial,
})

const recepcionista = usuario({ id: 10, sedeId: 1, nombre: 'Ana Recepción' })

async function montar() {
  const wrapper = mount(GestionStaffPage, {
    global: {
      provide: { [ServiciosKey as symbol]: servicios },
    },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('GestionStaffPage', () => {
  beforeEach(() => {
    servicios.usuarios.listar.mockReset().mockResolvedValue({ items: [recepcionista], total: 1 })
    servicios.usuarios.listarTodosPorRol.mockReset().mockResolvedValue([recepcionista])
    servicios.usuarios.crear.mockReset()
    servicios.sedes.listar.mockReset().mockResolvedValue([sede(1), sede(2), sede(3)])
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('muestra la vista del gerente central con los recepcionistas y su sede', async () => {
    const wrapper = await montar()

    expect(wrapper.get('h1').text()).toBe('Staff')
    expect(wrapper.get('header').text()).toContain('1 recepcionista')
    expect(wrapper.get('header').text()).toContain('Vista del gerente central: un recepcionista por sede.')
    expect(wrapper.get('table').text()).toContain('Ana Recepción')
    expect(wrapper.get('table').text()).toContain('Sede 1')
    expect(wrapper.find('input[name="rol-staff"]').exists()).toBe(false)
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('trae solo recepcionistas', async () => {
    const wrapper = await montar()

    expect(servicios.usuarios.listar).toHaveBeenCalledWith(
      { rol: 'RECEPCION' },
      1,
      10,
      expect.any(AbortSignal),
    )
    wrapper.unmount()
  })

  it('abre el alta de recepcionista y ofrece solo las sedes libres', async () => {
    const wrapper = await montar()

    await wrapper.get('header button').trigger('click')
    await flushPromises()

    const modal = wrapper.get('dialog[open]')
    expect(modal.get('h2').text()).toBe('Nuevo recepcionista')
    expect(modal.find('select[name="rol"]').exists()).toBe(false)
    expect(modal.get<HTMLSelectElement>('select[name="sedeId"]').element.value).toBe('')

    const opciones = modal.findAll('select[name="sedeId"] option').map((opcion) => opcion.text())
    expect(opciones).toEqual(['Elegí una sede', 'Sede 2', 'Sede 3'])
    wrapper.unmount()
  })

  it('crea el recepcionista con la sede elegida y cierra el modal', async () => {
    servicios.usuarios.crear.mockResolvedValue(usuario({ id: 30, nombre: 'Nuevo Recep', sedeId: 2 }))
    const wrapper = await montar()

    await wrapper.get('header button').trigger('click')
    await flushPromises()
    const modal = wrapper.get('dialog[open]')
    await modal.get('input[name="nombre"]').setValue('Nuevo Recep')
    await modal.get('input[name="dni"]').setValue('40111222')
    await modal.get('input[name="email"]').setValue('nuevo@fitzone.com.ar')
    await modal.get('input[name="contrasenia"]').setValue('Clave-Segura-123')
    await modal.get('select[name="sedeId"]').setValue('2')

    await modal.get('form').trigger('submit')
    await flushPromises()

    expect(servicios.usuarios.crear).toHaveBeenCalledWith({
      rol: 'RECEPCION',
      nombre: 'Nuevo Recep',
      dni: '40111222',
      email: 'nuevo@fitzone.com.ar',
      contrasenia: 'Clave-Segura-123',
      sedeId: 2,
    })
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    // Vuelve a pedir el listado para mostrar el alta.
    expect(servicios.usuarios.listar.mock.calls.length).toBeGreaterThan(1)
    wrapper.unmount()
  })

  it('sin sede no envía el alta y marca el campo', async () => {
    const wrapper = await montar()

    await wrapper.get('header button').trigger('click')
    await flushPromises()
    const modal = wrapper.get('dialog[open]')
    await modal.get('input[name="nombre"]').setValue('Nuevo Recep')
    await modal.get('input[name="dni"]').setValue('40111222')
    await modal.get('input[name="email"]').setValue('nuevo@fitzone.com.ar')
    await modal.get('input[name="contrasenia"]').setValue('Clave-Segura-123')

    await modal.get('form').trigger('submit')
    await flushPromises()

    expect(servicios.usuarios.crear).not.toHaveBeenCalled()
    expect(modal.text()).toContain('Elegí la sede de trabajo.')
    expect(wrapper.find('dialog[open]').exists()).toBe(true)
    wrapper.unmount()
  })
})
