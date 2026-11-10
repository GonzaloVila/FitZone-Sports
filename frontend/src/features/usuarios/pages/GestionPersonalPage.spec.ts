import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ServiciosKey } from '@/compartido/servicios'
import GestionPersonalPage from './GestionPersonalPage.vue'

// RF-01 (personal): el GERENTE ve los recepcionistas y da de alta uno nuevo con su sede de trabajo. Hay un recepcionista por
// sede, así que el alta solo ofrece las sedes libres.
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

const SEDES = [
  { id: 1, nombre: 'Belgrano', direccion: 'x', aforoMaximo: 100 },
  { id: 2, nombre: 'Palermo', direccion: 'y', aforoMaximo: 50 },
]
const LUCAS = { id: 3, rol: 'RECEPCION', nombre: 'Lucas Benítez', dni: '30111222', email: 'lucas@fitzone.com', sedeId: 1 }
const NUEVA = { id: 4, rol: 'RECEPCION', nombre: 'Marta Díaz', dni: '31222333', email: 'marta@fitzone.com', sedeId: 2 }

const servicios = {
  sedes: { listar: vi.fn() },
  usuarios: { listar: vi.fn(), listarTodosPorRol: vi.fn(), crear: vi.fn() },
}

async function montar(query: Record<string, string> = {}) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/personal', component: { render: () => null } }] })
  await router.push({ path: '/personal', query })
  const wrapper = mount(GestionPersonalPage, {
    global: { plugins: [router], provide: { [ServiciosKey as symbol]: servicios } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

async function abrirAlta(wrapper: Awaited<ReturnType<typeof montar>>) {
  await wrapper.findAll('button').find((b) => b.text().includes('Nuevo recepcionista'))!.trigger('click')
  await flushPromises()
}

describe('GestionPersonalPage', () => {
  beforeEach(() => {
    servicios.sedes.listar.mockReset().mockResolvedValue(SEDES)
    servicios.usuarios.listar.mockReset().mockResolvedValue({ items: [LUCAS], total: 1 })
    servicios.usuarios.listarTodosPorRol.mockReset().mockResolvedValue([LUCAS])
    servicios.usuarios.crear.mockReset().mockResolvedValue(NUEVA)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('lista solo recepcionistas, con el nombre de su sede', async () => {
    const wrapper = await montar()

    expect(servicios.usuarios.listar).toHaveBeenCalledWith({ rol: 'RECEPCION' }, 1, expect.any(Number), expect.any(AbortSignal))
    expect(wrapper.text()).toContain('Lucas Benítez')
    expect(wrapper.text()).toContain('Belgrano')
  })

  it('el alta solo ofrece las sedes que todavía no tienen recepcionista', async () => {
    const wrapper = await montar()

    await abrirAlta(wrapper)

    const opciones = wrapper.findAll('select[name="sedeId"] option').map((o) => o.text())
    expect(opciones).toContain('Palermo')
    expect(opciones).not.toContain('Belgrano')
  })

  it('da de alta un recepcionista en una sede libre y recarga la lista', async () => {
    const wrapper = await montar()
    await abrirAlta(wrapper)
    const consultas = servicios.usuarios.listar.mock.calls.length

    await wrapper.get('dialog input[name="nombre"]').setValue('Marta Díaz')
    await wrapper.get('dialog input[name="dni"]').setValue('31222333')
    await wrapper.get('dialog input[name="email"]').setValue('marta@fitzone.com')
    await wrapper.get('dialog select[name="sedeId"]').setValue('2')
    await wrapper.get('dialog input[name="contrasenia"]').setValue('Password123!')
    await wrapper.get('dialog form').trigger('submit')
    await flushPromises()

    expect(servicios.usuarios.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        rol: 'RECEPCION',
        nombre: 'Marta Díaz',
        dni: '31222333',
        email: 'marta@fitzone.com',
        contrasenia: 'Password123!',
        sedeId: 2,
      }),
    )
    expect(servicios.usuarios.listar.mock.calls.length).toBeGreaterThan(consultas)
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
  })

  it('con el formulario incompleto no da de alta a nadie', async () => {
    const wrapper = await montar()
    await abrirAlta(wrapper)

    await wrapper.get('dialog form').trigger('submit')
    await flushPromises()

    expect(servicios.usuarios.crear).not.toHaveBeenCalled()
    expect(wrapper.find('dialog[open]').exists()).toBe(true)
  })

  it('el filtro por sede viene de la dirección', async () => {
    await montar({ sede: '2' })

    expect(servicios.usuarios.listar).toHaveBeenLastCalledWith(
      { rol: 'RECEPCION', sedeId: 2 },
      1,
      expect.any(Number),
      expect.any(AbortSignal),
    )
  })

  it('sin recepcionistas lo dice', async () => {
    servicios.usuarios.listar.mockResolvedValue({ items: [], total: 0 })

    const wrapper = await montar()

    expect(wrapper.text()).toContain('Todavía no hay recepcionistas.')
  })
})
