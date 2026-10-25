import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ServiciosKey } from '@/compartido/servicios'
import TablaSocios from '../components/TablaSocios.vue'
import type { Socio } from '../services/servicioSocios'
import GestionSociosPage from './GestionSociosPage.vue'

// jsdom no trae ResizeObserver, que Reka (el menú de la tabla) usa para posicionar el contenido.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

const servicios = {
  socios: { listar: vi.fn(), obtenerMembresia: vi.fn(), modificarMembresia: vi.fn() },
  sedes: { listar: vi.fn() },
}

const pagina = { render: () => null }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/socios', name: 'socios', component: pagina },
    { path: '/socios/nuevo', name: 'socios-nuevo', component: pagina },
    { path: '/socios/:socioId', name: 'socio-detalle', component: pagina },
  ],
})

const socio = (id: number): Socio => ({
  id,
  usuarioId: id + 100,
  sedeOrigenId: 1,
  fechaAlta: '2026-01-15T10:00:00-03:00',
  nombre: `Socio ${id}`,
  email: `socio${id}@fitzone.com`,
})

async function montar() {
  await router.push('/socios')
  const wrapper = mount(GestionSociosPage, {
    global: { plugins: [router], provide: { [ServiciosKey as symbol]: servicios } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof montar>>

const regionPie = (wrapper: Wrapper) => wrapper.get('footer [role="status"]')

describe('GestionSociosPage', () => {
  beforeEach(() => {
    servicios.socios.listar.mockReset().mockResolvedValue({ items: [], total: 0 })
    servicios.socios.obtenerMembresia.mockReset().mockRejectedValue(new Error('sin membresía'))
    servicios.socios.modificarMembresia.mockReset()
    servicios.sedes.listar.mockReset().mockResolvedValue([])
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('arma la cabecera: título, conteo, subtítulo y "Nuevo socio" como enlace', async () => {
    servicios.socios.listar.mockResolvedValue({ items: [socio(1)], total: 1 })
    const wrapper = await montar()

    expect(wrapper.get('h1').text()).toBe('Socios')
    expect(wrapper.get('header').text()).toContain('1 socio')
    expect(wrapper.get('header').text()).toContain('Gestión de membresías, altas y consulta de socios.')
    const nuevo = wrapper.get('header a')
    expect(nuevo.text()).toBe('Nuevo socio')
    expect(nuevo.attributes('href')).toBe('/socios/nuevo')
    expect(wrapper.find('header a button').exists()).toBe(false)
    wrapper.unmount()
  })

  it('sin socios y sin filtros: "Todavía no hay socios." y un enlace a "Nuevo socio"', async () => {
    const wrapper = await montar()

    expect(wrapper.text()).toContain('Todavía no hay socios.')
    expect(wrapper.text()).not.toContain('No se encontraron socios')
    const enlaces = wrapper.findAll('a').filter((enlace) => enlace.text() === 'Nuevo socio')
    expect(enlaces).toHaveLength(2)
    expect(enlaces.every((enlace) => enlace.attributes('href') === '/socios/nuevo')).toBe(true)
    expect(wrapper.find('table').exists()).toBe(false)
    wrapper.unmount()
  })

  it('sin resultados con filtros: mensaje y "Limpiar filtros", que restaura el listado', async () => {
    const wrapper = await montar()

    await wrapper.get('select[name="estado"]').setValue('ACTIVA')
    await flushPromises()

    expect(wrapper.text()).toContain('No se encontraron socios con los filtros aplicados.')
    expect(wrapper.text()).not.toContain('Todavía no hay socios.')
    const limpiar = wrapper.findAll('button').find((boton) => boton.text() === 'Limpiar filtros')
    expect(limpiar).toBeDefined()

    await limpiar!.trigger('click')
    await flushPromises()

    expect((wrapper.get('select[name="estado"]').element as HTMLSelectElement).value).toBe('')
    expect(wrapper.text()).toContain('Todavía no hay socios.')
    wrapper.unmount()
  })

  it('mientras carga sin filas muestra "Cargando socios…" en una región de estado, sin estado vacío', async () => {
    servicios.socios.listar.mockReturnValue(new Promise(() => {}))
    const wrapper = await montar()

    const cargando = wrapper.findAll('[role="status"]').find((region) => region.text() === 'Cargando socios…')
    expect(cargando).toBeDefined()
    expect(wrapper.text()).not.toContain('Todavía no hay socios.')
    wrapper.unmount()
  })

  it('la región del pie existe siempre: cargando, vacía y con resultados', async () => {
    servicios.socios.listar.mockReturnValueOnce(new Promise(() => {}))
    const cargando = await montar()
    expect(regionPie(cargando).attributes('aria-live')).toBe('polite')
    expect(regionPie(cargando).attributes('aria-atomic')).toBe('true')
    cargando.unmount()

    const vacio = await montar()
    expect(regionPie(vacio).text()).toBe('0 socios')
    vacio.unmount()

    servicios.socios.listar.mockResolvedValue({ items: [socio(1), socio(2)], total: 2 })
    const conFilas = await montar()
    expect(regionPie(conFilas).text()).toBe('Mostrando 1 a 2 de 2 socios')
    conFilas.unmount()
  })

  it('con error la región del pie sigue en el DOM, vacía, y no muestra el estado vacío', async () => {
    servicios.socios.listar.mockRejectedValue(new Error('caído'))
    const wrapper = await montar()

    expect(regionPie(wrapper).text()).toBe('')
    expect(wrapper.text()).toContain('No se pudo cargar el listado de socios.')
    expect(wrapper.text()).not.toContain('Todavía no hay socios.')
    wrapper.unmount()
  })

  it('calcula el rango con la cantidad por página y muestra la paginación', async () => {
    servicios.socios.listar.mockResolvedValue({ items: Array.from({ length: 10 }, (_, i) => socio(i + 1)), total: 25 })
    const wrapper = await montar()

    expect(regionPie(wrapper).text()).toBe('Mostrando 1 a 10 de 25 socios')
    expect(wrapper.find('nav[aria-label="Paginación de socios"]').exists()).toBe(true)

    servicios.socios.listar.mockResolvedValue({ items: Array.from({ length: 5 }, (_, i) => socio(i + 21)), total: 25 })
    await wrapper.get('nav button:last-child').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(regionPie(wrapper).text()).toBe('Mostrando 11 a 20 de 25 socios')
    wrapper.unmount()
  })

  it('con un solo socio, el pie dice "socio" en singular', async () => {
    servicios.socios.listar.mockResolvedValue({ items: [socio(1)], total: 1 })
    const wrapper = await montar()

    expect(regionPie(wrapper).text()).toBe('Mostrando 1 a 1 de 1 socio')
    wrapper.unmount()
  })

  it('no existe un botón de exportar', async () => {
    servicios.socios.listar.mockResolvedValue({ items: [socio(1)], total: 1 })
    const wrapper = await montar()

    expect(wrapper.text()).not.toMatch(/exportar/i)
    expect(wrapper.findAll('button').some((boton) => /exportar|csv/i.test(boton.text()))).toBe(false)
    wrapper.unmount()
  })

  it('"ver-ficha" navega a la ficha sin acción en la URL', async () => {
    servicios.socios.listar.mockResolvedValue({ items: [socio(7)], total: 1 })
    const wrapper = await montar()

    wrapper.getComponent(TablaSocios).vm.$emit('abrir-accion', { socioId: 7, accion: 'ver-ficha' })
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('socio-detalle')
    expect(router.currentRoute.value.params.socioId).toBe('7')
    expect(router.currentRoute.value.query).toEqual({})
    wrapper.unmount()
  })

  it('una acción con modal navega a la ficha con ?accion=', async () => {
    servicios.socios.listar.mockResolvedValue({ items: [socio(7)], total: 1 })
    const wrapper = await montar()

    wrapper.getComponent(TablaSocios).vm.$emit('abrir-accion', { socioId: 7, accion: 'suspender' })
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/socios/7?accion=suspender')
    wrapper.unmount()
  })
})
