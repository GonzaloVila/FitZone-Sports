import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ServiciosKey } from '@/compartido/servicios'
import type { EstadoMembresia, Membresia, Socio } from '../services/servicioSocios'
import DetalleSocioPage from './DetalleSocioPage.vue'

// jsdom no implementa <dialog>.showModal(): se completa con lo mínimo para que el modal quede "abierto".
beforeAll(() => {
  const dialogo = HTMLDialogElement.prototype
  dialogo.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialogo.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const servicios = {
  socios: { obtener: vi.fn(), obtenerMembresia: vi.fn(), modificarMembresia: vi.fn() },
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
    global: {
      plugins: [router],
      provide: { [ServiciosKey as symbol]: servicios },
      // La ficha y el carnet no intervienen: se evita armar el QR y sus datos.
      stubs: { FichaSocio: true, CarnetSocio: true },
    },
    attachTo: document.body,
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

const botones = (wrapper: Awaited<ReturnType<typeof montar>>) =>
  wrapper.findAll('section[aria-labelledby="detalle-acciones"] button').filter((boton) => !boton.attributes('aria-label'))

describe('DetalleSocioPage: acciones de la ficha', () => {
  beforeEach(() => {
    servicios.socios.obtener.mockReset().mockResolvedValue(socio)
    servicios.socios.obtenerMembresia.mockReset().mockResolvedValue(membresia('ACTIVA'))
    servicios.socios.modificarMembresia.mockReset()
    servicios.usuarios.obtener.mockReset().mockResolvedValue({ id: 101, dni: '30111222' })
    servicios.sedes.listar.mockReset().mockResolvedValue([])
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('ya no interpreta ?accion=: no abre ningún modal ni toca la URL', async () => {
    const wrapper = await montar({ accion: 'suspender' })

    expect(wrapper.findAll('dialog[open]')).toHaveLength(0)
    expect(router.currentRoute.value.query).toEqual({ accion: 'suspender' })
    wrapper.unmount()
  })

  it('VENCIDA: el botón dice "Renovar" y está habilitado', async () => {
    servicios.socios.obtenerMembresia.mockResolvedValue(membresia('VENCIDA'))
    const wrapper = await montar()

    const renovar = botones(wrapper).find((boton) => boton.text() === 'Renovar')
    expect(renovar?.attributes('disabled')).toBeUndefined()
    expect(botones(wrapper).some((boton) => boton.text() === 'Cambiar plan')).toBe(false)
    wrapper.unmount()
  })

  it('ACTIVA: el botón dice "Cambiar plan" y está habilitado', async () => {
    const wrapper = await montar()

    const cambiar = botones(wrapper).find((boton) => boton.text() === 'Cambiar plan')
    expect(cambiar?.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('SUSPENDIDA: "Cambiar plan" queda deshabilitado (primero se reactiva)', async () => {
    servicios.socios.obtenerMembresia.mockResolvedValue(membresia('SUSPENDIDA'))
    const wrapper = await montar()

    const cambiar = botones(wrapper).find((boton) => boton.text() === 'Cambiar plan')
    expect(cambiar?.attributes('disabled')).toBeDefined()
    expect(botones(wrapper).some((boton) => boton.text() === 'Reactivar')).toBe(true)
    wrapper.unmount()
  })
})
