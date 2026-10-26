import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import MenuAccionesFz from './MenuAccionesFz.vue'

// jsdom no trae ResizeObserver, que Reka usa para posicionar el contenido. Es un faltante del entorno, no
// de la lógica: se completa con una clase vacía y el resto de Reka corre de verdad.
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

const acciones = [
  { clave: 'ver', etiqueta: 'Ver ficha' },
  { clave: 'editar', etiqueta: 'Editar' },
  { clave: 'bloquear', etiqueta: 'Bloquear', peligro: true },
  { clave: 'exportar', etiqueta: 'Exportar', deshabilitada: true },
]

function montar() {
  return mount(MenuAccionesFz, {
    props: { etiqueta: 'Acciones de Camila Domínguez', acciones },
    attachTo: document.body,
  })
}

async function abrir(wrapper: ReturnType<typeof montar>) {
  await wrapper.get('button').trigger('keydown', { key: 'Enter' })
  await vi.waitFor(() => expect(document.body.querySelector('[role="menu"]')).not.toBeNull())
}

const items = () => [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]

describe('MenuAccionesFz', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('el disparador es un botón con el aria-label recibido y el menú arranca cerrado', () => {
    const wrapper = montar()
    const disparador = wrapper.get('button')

    expect(disparador.attributes('aria-label')).toBe('Acciones de Camila Domínguez')
    expect(disparador.attributes('aria-haspopup')).toBe('menu')
    expect(disparador.attributes('aria-expanded')).toBe('false')
    expect(document.body.querySelector('[role="menu"]')).toBeNull()
    wrapper.unmount()
  })

  it('el identificador opcional se publica en el disparador (data-identificador), y sin él no hay atributo', () => {
    const con = mount(MenuAccionesFz, {
      props: { etiqueta: 'Acciones', acciones, identificador: 'menu-socio-7' },
      attachTo: document.body,
    })
    expect(con.get('button').attributes('data-identificador')).toBe('menu-socio-7')
    con.unmount()

    const sin = montar()
    expect(sin.get('button').attributes('data-identificador')).toBeUndefined()
    sin.unmount()
  })

  it('con el teclado abre el menú en el portal con todas las acciones', async () => {
    const wrapper = montar()

    await abrir(wrapper)

    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true')
    expect(items().map((item) => item.textContent?.trim())).toEqual(['Ver ficha', 'Editar', 'Bloquear', 'Exportar'])
    // Está fuera del árbol del componente (Portal).
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('marca como deshabilitado el ítem deshabilitado', async () => {
    const wrapper = montar()

    await abrir(wrapper)

    expect(items()[3]?.getAttribute('data-disabled')).not.toBeNull()
    expect(items()[0]?.getAttribute('data-disabled')).toBeNull()
    wrapper.unmount()
  })

  it('al activar un ítem emite seleccionar con su clave y cierra el menú', async () => {
    const wrapper = montar()
    await abrir(wrapper)

    items()[1]!.click()

    await vi.waitFor(() => expect(wrapper.emitted('seleccionar')).toEqual([['editar']]))
    await vi.waitFor(() => expect(document.body.querySelector('[role="menu"]')).toBeNull())
    wrapper.unmount()
  })

  it('un ítem deshabilitado no emite seleccionar', async () => {
    const wrapper = montar()
    await abrir(wrapper)

    items()[3]!.click()
    await Promise.resolve()

    expect(wrapper.emitted('seleccionar')).toBeUndefined()
    wrapper.unmount()
  })

  it('dibuja una línea antes del ítem marcado como separado, y solo ahí', async () => {
    const wrapper = mount(MenuAccionesFz, {
      props: { etiqueta: 'Acciones', acciones: [...acciones.slice(0, 2), { ...acciones[2]!, separada: true }] },
      attachTo: document.body,
    })
    await abrir(wrapper)

    const hijos = [...document.body.querySelector('[role="menu"]')!.children]
    expect(hijos.map((hijo) => hijo.getAttribute('role'))).toEqual(['menuitem', 'menuitem', 'separator', 'menuitem'])
    expect(items().map((item) => item.textContent?.trim())).toEqual(['Ver ficha', 'Editar', 'Bloquear'])
    wrapper.unmount()
  })

  it('sin ítems separados no hay ninguna línea', async () => {
    const wrapper = montar()
    await abrir(wrapper)

    expect(document.body.querySelector('[role="separator"]')).toBeNull()
    wrapper.unmount()
  })

  it('Escape cierra el menú y devuelve el foco al disparador', async () => {
    const wrapper = montar()
    await abrir(wrapper)

    document.body.querySelector('[role="menu"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    await vi.waitFor(() => expect(document.body.querySelector('[role="menu"]')).toBeNull())
    expect(document.activeElement).toBe(wrapper.get('button').element)
    wrapper.unmount()
  })
})
