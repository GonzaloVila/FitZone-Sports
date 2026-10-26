import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ErrorApi } from '@/compartido/http/errores'
import { ServiciosKey } from '@/compartido/servicios'
import type { EstadoMembresia, Membresia, Socio } from '../services/servicioSocios'
import DetalleSocioPage from './DetalleSocioPage.vue'

// jsdom no trae ResizeObserver (Reka, el menú de la ficha) ni implementa <dialog>.showModal() (los modales).
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
  socios: { obtener: vi.fn(), obtenerMembresia: vi.fn(), modificarMembresia: vi.fn(), modificar: vi.fn() },
  usuarios: { obtener: vi.fn() },
  sedes: { listar: vi.fn() },
}

const pagina = { render: () => null }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/socios', name: 'socios', component: pagina },
    { path: '/socios/:socioId', name: 'socio-detalle', component: pagina },
  ],
})

const socio: Socio = {
  id: 1,
  usuarioId: 101,
  sedeOrigenId: 1,
  fechaAlta: '2026-01-15T10:00:00-03:00',
  nombre: 'Camila Domínguez',
  email: 'camila@fitzone.com',
}

const membresia = (estado: EstadoMembresia): Membresia => ({
  id: 1,
  plan: 'MENSUAL',
  estado,
  fechaInicio: '2026-01-15T00:00:00-03:00',
  fechaFin: '2026-02-15T00:00:00-03:00',
  renuevaAutomatica: false,
})

async function montar(query: Record<string, string> = {}) {
  await router.push({ name: 'socio-detalle', params: { socioId: '1' }, query })
  const wrapper = mount(DetalleSocioPage, {
    global: { plugins: [router], provide: { [ServiciosKey as symbol]: servicios } },
    attachTo: document.body,
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

describe('DetalleSocioPage', () => {
  beforeEach(() => {
    servicios.socios.obtener.mockReset().mockResolvedValue(socio)
    servicios.socios.obtenerMembresia.mockReset().mockResolvedValue(membresia('ACTIVA'))
    servicios.usuarios.obtener.mockReset().mockResolvedValue({ id: 101, dni: '30111222', telefono: '1155550000' })
    servicios.sedes.listar.mockReset().mockResolvedValue([{ id: 1, nombre: 'Sede Centro' }])
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('mientras carga muestra el título y "Cargando socio…", sin ficha', async () => {
    servicios.socios.obtener.mockReturnValue(new Promise(() => {}))
    const wrapper = await montar()

    expect(wrapper.get('h1').text()).toBe('Ficha del socio')
    expect(wrapper.text()).toContain('Cargando socio…')
    expect(wrapper.find('article').exists()).toBe(false)
    wrapper.unmount()
  })

  it('un 404 avisa que el socio no existe', async () => {
    servicios.socios.obtener.mockRejectedValue(new ErrorApi(404, 'No existe'))
    const wrapper = await montar()

    expect(wrapper.text()).toContain('El socio no existe o ya no es socio.')
    expect(wrapper.find('article').exists()).toBe(false)
    wrapper.unmount()
  })

  it('otro error muestra su mensaje', async () => {
    servicios.socios.obtener.mockRejectedValue(new ErrorApi(500, 'Falló el servidor'))
    const wrapper = await montar()

    expect(wrapper.text()).toContain('Falló el servidor')
    wrapper.unmount()
  })

  it('con el socio cargado arma la ficha: enlace de vuelta, h1 fijo y los datos en la tarjeta', async () => {
    const wrapper = await montar()

    expect(wrapper.get('a').text()).toBe('Volver a socios')
    expect(wrapper.get('h1').text()).toBe('Ficha del socio')
    const ficha = wrapper.get('article')
    for (const texto of ['Camila Domínguez', '30111222', 'Sede Centro', 'camila@fitzone.com', '1155550000', 'Mensual', 'Activa']) {
      expect(ficha.text()).toContain(texto)
    }
    expect(wrapper.findAll('dialog[open]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('con ?alta=1 muestra el aviso de alta y lo saca de la URL; sin eso, no hay aviso', async () => {
    const conAlta = await montar({ alta: '1' })
    expect(conAlta.text()).toContain('El socio se dio de alta correctamente.')
    expect(router.currentRoute.value.query).toEqual({})
    conAlta.unmount()

    const sinAlta = await montar()
    expect(sinAlta.text()).not.toContain('El socio se dio de alta correctamente.')
    sinAlta.unmount()
  })

  it('ya no interpreta ?accion=: no abre ningún modal ni toca la URL', async () => {
    const wrapper = await montar({ accion: 'suspender' })

    expect(wrapper.findAll('dialog[open]')).toHaveLength(0)
    expect(router.currentRoute.value.query).toEqual({ accion: 'suspender' })
    wrapper.unmount()
  })
})
