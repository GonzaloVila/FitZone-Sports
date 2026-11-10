import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ServiciosKey } from '@/compartido/servicios'
import ArmazonApp from './ArmazonApp.vue'

// RF-03: el armazón de la app autenticada. El menú sale de las rutas con meta.navegacion, filtradas por el rol de la
// sesión; el personal trabaja con barra lateral agrupada por sección y el socio o externo con barra superior. "Cerrar
// sesión" siempre termina en el login, aunque falle el aviso al servidor.
enableAutoUnmount(afterEach)

const vacia = { render: () => null }
const RUTAS = [
  { path: '/login', name: 'login', component: vacia, meta: { publica: true } },
  { path: '/carnet', name: 'carnet', component: vacia, meta: { roles: ['SOCIO'], navegacion: { etiqueta: 'Mi carnet', orden: 1 } } },
  { path: '/socios', name: 'socios', component: vacia, meta: { roles: ['RECEPCION', 'GERENTE'], navegacion: { etiqueta: 'Socios', orden: 2, seccion: 'operaciones' } } },
  { path: '/socios/:socioId', name: 'socio-detalle', component: vacia, meta: { roles: ['RECEPCION', 'GERENTE'] } },
  { path: '/clases', name: 'clases', component: vacia, meta: { roles: ['SOCIO', 'GERENTE'], navegacion: { etiqueta: 'Clases', orden: 4, seccion: 'actividades' } } },
  { path: '/reportes', name: 'reportes', component: vacia, meta: { roles: ['GERENTE'], navegacion: { etiqueta: 'Reportes', orden: 9, seccion: 'administracion' } } },
] as const

const servicios = {
  sesion: { cerrarSesion: vi.fn() },
  usuarios: { obtener: vi.fn() },
  sedes: { listar: vi.fn() },
}

let router: ReturnType<typeof createRouter>

async function montar(usuario: Record<string, unknown>, ruta: string) {
  router = createRouter({ history: createMemoryHistory(), routes: [...RUTAS] as never })
  await router.push(ruta)
  const pinia = createPinia()
  pinia.state.value.sesion = { usuario, restaurada: true }
  const wrapper = mount(ArmazonApp, {
    global: { plugins: [pinia, router], provide: { [ServiciosKey as symbol]: servicios } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const etiquetasDelMenu = (wrapper: Awaited<ReturnType<typeof montar>>) =>
  wrapper.findAll('.armazon-app__enlace').map((a) => a.text())

describe('ArmazonApp', () => {
  beforeEach(() => {
    servicios.sesion.cerrarSesion.mockReset().mockResolvedValue(undefined)
    servicios.usuarios.obtener.mockReset().mockResolvedValue({ id: 3, nombre: 'Valeria Rossi', email: 'valeria@fitzone.com' })
    servicios.sedes.listar.mockReset().mockResolvedValue([])
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('el GERENTE ve solo sus ítems, agrupados por sección y ordenados', async () => {
    const wrapper = await montar({ rol: 'GERENTE', usuarioId: 3 }, '/socios')

    expect(etiquetasDelMenu(wrapper)).toEqual(['Socios', 'Clases', 'Reportes'])
    expect(wrapper.findAll('.armazon-app__seccion').map((p) => p.text())).toEqual([
      'Operaciones',
      'Clases y deporte',
      'Administración',
    ])
    expect(wrapper.text()).not.toContain('Mi carnet')
  })

  it('el SOCIO ve una barra superior plana con sus ítems', async () => {
    const wrapper = await montar({ rol: 'SOCIO', usuarioId: 9, socioId: 12 }, '/carnet')

    expect(etiquetasDelMenu(wrapper)).toEqual(['Mi carnet', 'Clases'])
    expect(wrapper.find('.armazon-app__seccion').exists()).toBe(false)
    expect(wrapper.text()).toContain('Cerrar sesión')
  })

  it('marca el ítem de la pantalla actual y el de la sección cuando se está adentro', async () => {
    const wrapper = await montar({ rol: 'GERENTE', usuarioId: 3 }, '/socios')
    const socios = () => wrapper.findAll('.armazon-app__enlace').find((a) => a.text() === 'Socios')!
    expect(socios().attributes('aria-current')).toBe('page')

    await router.push('/socios/12')
    await flushPromises()

    expect(socios().attributes('aria-current')).toBe('true')
  })

  it('muestra el nombre y el email del usuario en el pie del personal', async () => {
    const wrapper = await montar({ rol: 'GERENTE', usuarioId: 3 }, '/socios')

    expect(servicios.usuarios.obtener).toHaveBeenCalledWith(3, expect.any(AbortSignal))
    expect(wrapper.text()).toContain('Valeria Rossi')
    expect(wrapper.text()).toContain('valeria@fitzone.com')
  })

  it('cerrar sesión avisa al servidor y lleva al login', async () => {
    const wrapper = await montar({ rol: 'GERENTE', usuarioId: 3 }, '/socios')

    await wrapper.get('button[aria-label="Cerrar sesión"]').trigger('click')
    await flushPromises()

    expect(servicios.sesion.cerrarSesion).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('aunque el servidor falle al cerrar sesión, igual lleva al login', async () => {
    servicios.sesion.cerrarSesion.mockRejectedValue(new Error('caído'))
    const wrapper = await montar({ rol: 'SOCIO', usuarioId: 9, socioId: 12 }, '/carnet')

    await wrapper.findAll('button').find((b) => b.text().includes('Cerrar sesión'))!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('login')
  })
})
