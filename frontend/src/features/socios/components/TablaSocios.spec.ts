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

const pagina = { render: () => null }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/socios/:socioId', name: 'socio-detalle', component: pagina }],
})

function fila(id: number, nombre: string, membresia: FilaSocio['membresia']): FilaSocio {
  return {
    socio: {
      id,
      usuarioId: id + 100,
      sedeOrigenId: 1,
      fechaAlta: '2026-01-15T10:00:00-03:00',
      nombre,
      email: `${nombre.split(' ')[0]?.toLowerCase()}@fitzone.com`,
    },
    membresia,
  }
}

const disponible = (estado: EstadoMembresia, renuevaAutomatica = false): FilaSocio['membresia'] => ({
  situacion: 'disponible',
  membresia: {
    id: 1,
    plan: 'TRIMESTRAL',
    estado,
    fechaInicio: '2026-01-15T00:00:00-03:00',
    fechaFin: '2026-04-15T00:00:00-03:00',
    renuevaAutomatica,
  },
})

const filas = [
  fila(1, 'Camila Domínguez', disponible('ACTIVA', true)),
  fila(2, 'Bruno Paz', disponible('SUSPENDIDA')),
  fila(3, 'Elena Ríos', disponible('VENCIDA')),
  fila(4, 'Diego Sosa', { situacion: 'no-disponible' }),
  fila(5, 'Franco Luna', { situacion: 'cargando' }),
]

function montar(props: { guardandoRenovacion?: ReadonlySet<number> } = {}) {
  return mount(TablaSocios, {
    props: {
      filas,
      nombreSede: (id: number) => `Sede ${id}`,
      guardandoRenovacion: new Set<number>(),
      ...props,
    },
    global: { plugins: [router] },
    attachTo: document.body,
  })
}

type Wrapper = ReturnType<typeof montar>

const filaDe = (wrapper: Wrapper, nombre: string) => {
  const encontrada = wrapper.findAll('tbody tr').find((tr) => tr.text().includes(nombre))
  if (!encontrada) throw new Error(`No hay fila de ${nombre}`)
  return encontrada
}

const items = () => [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]

async function abrirMenu(wrapper: Wrapper, nombre: string) {
  await wrapper.get(`button[aria-label="Acciones de ${nombre}"]`).trigger('keydown', { key: 'Enter' })
  await vi.waitFor(() => expect(items().length).toBeGreaterThan(0))
  return items().map((item) => ({
    texto: item.textContent?.trim(),
    deshabilitado: item.getAttribute('data-disabled') !== null,
    peligro: item.classList.contains('menu-acciones__item--peligro'),
  }))
}

describe('TablaSocios', () => {
  it('muestra las columnas pedidas', () => {
    const wrapper = montar()

    expect(wrapper.findAll('thead th').map((th) => th.text())).toEqual([
      'Socio',
      'Sede',
      'Fecha de alta',
      'Plan',
      'Estado',
      'Renovación automática',
      'Acciones',
    ])
    wrapper.unmount()
  })

  it('la celda del socio tiene avatar decorativo, nombre como enlace a la ficha, #id con su title y email', () => {
    const wrapper = montar()
    const celda = filaDe(wrapper, 'Camila Domínguez').get('th')

    expect(celda.get('[aria-hidden="true"]').text()).toBe('CD')
    const enlace = celda.get('a')
    expect(enlace.text()).toBe('Camila Domínguez')
    expect(enlace.attributes('href')).toBe('/socios/1')
    expect(celda.get('[title="ID de socio para registrar accesos"]').text()).toBe('#1')
    expect(celda.get('[title="camila@fitzone.com"]').text()).toBe('camila@fitzone.com')
    wrapper.unmount()
  })

  it('muestra sede, fecha, plan y estado; sin membresía, textos neutros', () => {
    const wrapper = montar()
    const activa = filaDe(wrapper, 'Camila').findAll('td').map((td) => td.text())
    const sinDatos = filaDe(wrapper, 'Diego').findAll('td').map((td) => td.text())
    const cargando = filaDe(wrapper, 'Franco').findAll('td').map((td) => td.text())

    expect(activa.slice(0, 4)).toEqual(['Sede 1', '15/01/2026', 'Trimestral', 'Activa'])
    expect(sinDatos.slice(0, 4)).toEqual(['Sede 1', '15/01/2026', 'Sin plan', '—'])
    expect(cargando.slice(2, 5)).toEqual(['Cargando…', 'Cargando…', 'Cargando…'])
    wrapper.unmount()
  })

  it('el interruptor refleja la renovación automática y su nombre incluye al socio', () => {
    const wrapper = montar()
    const activo = filaDe(wrapper, 'Camila').get('button[role="switch"]')
    const apagado = filaDe(wrapper, 'Bruno').get('button[role="switch"]')

    expect(activo.attributes('aria-label')).toBe('Renovación automática de Camila Domínguez')
    expect(activo.attributes('aria-checked')).toBe('true')
    expect(apagado.attributes('aria-checked')).toBe('false')
    wrapper.unmount()
  })

  it('sin membresía disponible no hay interruptor: "—" o "Cargando…"', () => {
    const wrapper = montar()

    expect(filaDe(wrapper, 'Diego').find('[role="switch"]').exists()).toBe(false)
    expect(filaDe(wrapper, 'Franco').find('[role="switch"]').exists()).toBe(false)
    expect(filaDe(wrapper, 'Diego').findAll('td')[4]?.text()).toBe('—')
    expect(filaDe(wrapper, 'Franco').findAll('td')[4]?.text()).toBe('Cargando…')
    wrapper.unmount()
  })

  it('el interruptor del socio que se está guardando queda ocupado y no emite', async () => {
    const wrapper = montar({ guardandoRenovacion: new Set([2]) })
    const ocupado = filaDe(wrapper, 'Bruno').get('button[role="switch"]')

    expect(ocupado.attributes('aria-busy')).toBe('true')
    expect(filaDe(wrapper, 'Camila').get('button[role="switch"]').attributes('aria-busy')).toBeUndefined()

    await ocupado.trigger('click')
    expect(wrapper.emitted('alternar-renovacion')).toBeUndefined()
    wrapper.unmount()
  })

  it('al tocar el interruptor emite alternar-renovacion con el id del socio y no cambia solo', async () => {
    const wrapper = montar()
    const interruptor = filaDe(wrapper, 'Bruno').get('button[role="switch"]')

    await interruptor.trigger('click')

    expect(wrapper.emitted('alternar-renovacion')).toEqual([[2]])
    expect(interruptor.attributes('aria-checked')).toBe('false')
    wrapper.unmount()
  })

  it('la columna Acciones tiene solo el botón del menú, sin enlace "Ver"', () => {
    const wrapper = montar()

    for (const fila of wrapper.findAll('tbody tr')) {
      const celda = fila.findAll('td').at(-1)!
      expect(celda.findAll('button')).toHaveLength(1)
      expect(celda.get('button').attributes('aria-haspopup')).toBe('menu')
      expect(celda.find('a').exists()).toBe(false)
    }
    expect(wrapper.findAll('a').some((enlace) => enlace.text() === 'Ver')).toBe(false)
    wrapper.unmount()
  })

  it('todas las columnas menos Socio se ajustan a su contenido, la de renovación va centrada y la de acciones a la derecha', () => {
    const wrapper = montar()
    const encabezados = wrapper.findAll('thead th')
    const fila = wrapper.findAll('tbody tr')[0]!

    // Solo Socio se queda con el espacio sobrante.
    expect(encabezados[0]!.classes()).not.toContain('tabla__encabezado--ajustada')
    for (const encabezado of encabezados.slice(1)) expect(encabezado.classes()).toContain('tabla__encabezado--ajustada')

    const renovacion = encabezados[5]!
    expect(renovacion.text()).toBe('Renovación automática')
    expect(renovacion.classes()).toEqual(expect.arrayContaining(['tabla__encabezado--en-lineas', 'tabla__encabezado--centro']))
    expect(fila.findAll('td')[4]!.classes()).toContain('tabla__celda--centro')

    expect(encabezados[6]!.classes()).toContain('tabla__encabezado--fin')
    expect(fila.findAll('td')[5]!.classes()).toContain('tabla__celda--fin')
    wrapper.unmount()
  })

  it('el menú de cada fila se llama "Acciones de {nombre}"', () => {
    const wrapper = montar()

    expect(wrapper.findAll('button[aria-label^="Acciones de"]').map((boton) => boton.attributes('aria-label'))).toEqual(
      filas.map((f) => `Acciones de ${f.socio.nombre}`),
    )
    wrapper.unmount()
  })

  it('ACTIVA: Suspender y Cambiar plan habilitados; Dejar de ser socio marcado como peligro', async () => {
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

  it('SUSPENDIDA: ofrece Reactivar en lugar de Suspender', async () => {
    const wrapper = montar()

    const menu = await abrirMenu(wrapper, 'Bruno Paz')

    expect(menu.map((item) => item.texto)).toEqual(['Ver ficha', 'Cambiar plan', 'Reactivar', 'Dejar de ser socio'])
    expect(menu[2]?.deshabilitado).toBe(false)
    wrapper.unmount()
  })

  it('VENCIDA: Suspender deshabilitado, Cambiar plan habilitado', async () => {
    const wrapper = montar()

    const menu = await abrirMenu(wrapper, 'Elena Ríos')

    expect(menu.map((item) => [item.texto, item.deshabilitado])).toEqual([
      ['Ver ficha', false],
      ['Cambiar plan', false],
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

  it('elegir una acción emite abrir-accion con el socio y la acción', async () => {
    const wrapper = montar()
    await abrirMenu(wrapper, 'Bruno Paz')

    items()
      .find((item) => item.textContent?.includes('Reactivar'))!
      .click()

    await vi.waitFor(() => expect(wrapper.emitted('abrir-accion')).toEqual([[{ socioId: 2, accion: 'reactivar' }]]))
    wrapper.unmount()
  })

  it('cada ítem emite su acción: ver-ficha, cambiar-plan, suspender y dejar-de-ser-socio', async () => {
    const wrapper = montar()
    const pedidas: unknown[] = []

    for (const texto of ['Ver ficha', 'Cambiar plan', 'Suspender', 'Dejar de ser socio']) {
      await abrirMenu(wrapper, 'Camila Domínguez')
      items()
        .find((item) => item.textContent?.trim() === texto)!
        .click()
      await vi.waitFor(() => expect(wrapper.emitted('abrir-accion')?.length).toBe(pedidas.length + 1))
      pedidas.push(wrapper.emitted('abrir-accion')?.at(-1)?.[0])
      await vi.waitFor(() => expect(document.body.querySelector('[role="menu"]')).toBeNull())
    }

    expect(pedidas).toEqual([
      { socioId: 1, accion: 'ver-ficha' },
      { socioId: 1, accion: 'cambiar-plan' },
      { socioId: 1, accion: 'suspender' },
      { socioId: 1, accion: 'dejar-de-ser-socio' },
    ])
    wrapper.unmount()
  })

  it('un ítem deshabilitado no emite', async () => {
    const wrapper = montar()
    await abrirMenu(wrapper, 'Elena Ríos')

    items()
      .find((item) => item.textContent?.trim() === 'Suspender')!
      .click()
    await Promise.resolve()

    expect(wrapper.emitted('abrir-accion')).toBeUndefined()
    wrapper.unmount()
  })
})
