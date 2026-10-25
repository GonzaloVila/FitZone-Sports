import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { EstadoMembresia } from '../services/servicioSocios'
import type { FilaSocio } from '../tipos'
import TablaSocios from './TablaSocios.vue'

// jsdom no trae ResizeObserver, que Reka (el menú) usa para posicionar el contenido.
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

afterEach(() => {
  document.body.innerHTML = ''
})

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/socios/:socioId', name: 'socio-detalle', component: { render: () => null } }],
})

function fila(id: number, nombre: string, membresia: FilaSocio['membresia']): FilaSocio {
  return {
    socio: { id, usuarioId: id + 100, sedeOrigenId: 1, fechaAlta: '2026-01-15T10:00:00-03:00', nombre, email: `socio${id}@fitzone.com` },
    membresia,
  }
}

const disponible = (estado: EstadoMembresia): FilaSocio['membresia'] => ({
  situacion: 'disponible',
  membresia: {
    id: 1,
    plan: 'TRIMESTRAL',
    estado,
    fechaInicio: '2026-01-15T00:00:00-03:00',
    fechaFin: '2026-04-15T00:00:00-03:00',
    renuevaAutomatica: false,
  },
})

const filas = [
  fila(1, 'Camila Domínguez', disponible('ACTIVA')),
  fila(2, 'Bruno Paz', disponible('SUSPENDIDA')),
  fila(3, 'Elena Ríos', disponible('VENCIDA')),
  fila(4, 'Diego Sosa', { situacion: 'no-disponible' }),
  fila(5, 'Franco Luna', { situacion: 'cargando' }),
]

function montar() {
  return mount(TablaSocios, {
    props: { filas, nombreSede: (id: number) => `Sede ${id}`, guardandoRenovacion: new Set<number>() },
    global: { plugins: [router] },
    attachTo: document.body,
  })
}

const items = () => [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]

async function abrirMenu(wrapper: ReturnType<typeof montar>, nombre: string) {
  await wrapper.get(`button[aria-label="Acciones de ${nombre}"]`).trigger('keydown', { key: 'Enter' })
  await vi.waitFor(() => expect(items().length).toBeGreaterThan(0))
  return items().map((item) => ({
    texto: item.textContent?.trim(),
    deshabilitado: item.getAttribute('data-disabled') !== null,
    peligro: item.classList.contains('menu-acciones__item--peligro'),
  }))
}

describe('TablaSocios: menú de acciones según el estado de la membresía', () => {
  it('el menú de cada fila se llama "Acciones de {nombre}"', () => {
    const wrapper = montar()

    expect(wrapper.findAll('button[aria-label^="Acciones de"]').map((boton) => boton.attributes('aria-label'))).toEqual(
      filas.map((f) => `Acciones de ${f.socio.nombre}`),
    )
    wrapper.unmount()
  })

  it('cada disparador lleva un identificador propio (para devolverle el foco)', () => {
    const wrapper = montar()

    expect(wrapper.findAll('button[aria-label^="Acciones de"]').map((boton) => boton.attributes('data-identificador'))).toEqual(
      filas.map((f) => `menu-socio-${f.socio.id}`),
    )
    wrapper.unmount()
  })

  it('ACTIVA: todo habilitado; Dejar de ser socio marcado como peligro', async () => {
    const wrapper = montar()

    const menu = await abrirMenu(wrapper, 'Camila Domínguez')

    expect(menu).toEqual([
      { texto: 'Ver ficha', deshabilitado: false, peligro: false },
      { texto: 'Cambiar plan', deshabilitado: false, peligro: false },
      { texto: 'Suspender', deshabilitado: false, peligro: false },
      { texto: 'Dejar de ser socio', deshabilitado: false, peligro: true },
    ])
    wrapper.unmount()
  })

  it('SUSPENDIDA: ofrece Reactivar en lugar de Suspender y "Cambiar plan" queda deshabilitado', async () => {
    const wrapper = montar()

    const menu = await abrirMenu(wrapper, 'Bruno Paz')

    expect(menu.map((item) => [item.texto, item.deshabilitado])).toEqual([
      ['Ver ficha', false],
      ['Cambiar plan', true],
      ['Reactivar', false],
      ['Dejar de ser socio', false],
    ])
    wrapper.unmount()
  })

  it('VENCIDA: la opción de plan dice "Renovar" y está habilitada; Suspender deshabilitado', async () => {
    const wrapper = montar()

    const menu = await abrirMenu(wrapper, 'Elena Ríos')

    expect(menu.map((item) => [item.texto, item.deshabilitado])).toEqual([
      ['Ver ficha', false],
      ['Renovar', false],
      ['Suspender', true],
      ['Dejar de ser socio', false],
    ])
    wrapper.unmount()
  })

  it('sin membresía disponible: Cambiar plan y Suspender deshabilitados; Ver ficha y Dejar de ser socio no', async () => {
    const wrapper = montar()

    const menu = await abrirMenu(wrapper, 'Diego Sosa')

    expect(menu.map((item) => [item.texto, item.deshabilitado])).toEqual([
      ['Ver ficha', false],
      ['Cambiar plan', true],
      ['Suspender', true],
      ['Dejar de ser socio', false],
    ])
    wrapper.unmount()
  })

  it('con la membresía cargando pasa lo mismo que sin membresía', async () => {
    const wrapper = montar()

    const menu = await abrirMenu(wrapper, 'Franco Luna')

    expect(menu.filter((item) => item.deshabilitado).map((item) => item.texto)).toEqual(['Cambiar plan', 'Suspender'])
    wrapper.unmount()
  })
})
