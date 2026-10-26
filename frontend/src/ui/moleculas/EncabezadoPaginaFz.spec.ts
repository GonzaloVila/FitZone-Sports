import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import EncabezadoPaginaFz from './EncabezadoPaginaFz.vue'

const pagina = { render: () => null }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'inicio', component: pagina },
    { path: '/acceso/aforo', name: 'acceso-aforo', component: pagina },
  ],
})

function montar(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(EncabezadoPaginaFz, {
    props: { titulo: 'Historial de accesos', ...props },
    slots,
    global: { plugins: [router] },
  })
}

describe('EncabezadoPaginaFz', () => {
  it('el título es un h1', () => {
    const wrapper = montar()

    expect(wrapper.get('h1').text()).toBe('Historial de accesos')
    expect(wrapper.element.tagName).toBe('HEADER')
  })

  it('sin subtítulo, sin volver y sin slots no dibuja nada de eso', () => {
    const wrapper = montar()

    expect(wrapper.find('p').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.find('.encabezado__acciones').exists()).toBe(false)
  })

  it('el subtítulo es opcional y va debajo del título', () => {
    const wrapper = montar({ subtitulo: 'Ingresos y egresos de las sedes.' })

    expect(wrapper.get('p').text()).toBe('Ingresos y egresos de las sedes.')
  })

  it('volver dibuja un enlace con el texto, la flecha decorativa y el destino de la ruta', () => {
    const wrapper = montar({ volver: { texto: 'Volver al aforo', a: { name: 'acceso-aforo' } } })
    const enlace = wrapper.get('a')

    expect(enlace.text()).toBe('Volver al aforo')
    expect(enlace.attributes('href')).toBe('/acceso/aforo')
    expect(enlace.get('svg').attributes('aria-hidden')).toBe('true')
  })

  it('el enlace de volver va antes del título', () => {
    const wrapper = montar({ volver: { texto: 'Volver al aforo', a: '/acceso/aforo' } })
    const html = wrapper.html()

    expect(html.indexOf('Volver al aforo')).toBeLessThan(html.indexOf('<h1'))
  })

  it('el slot "insignia" queda junto al título y "acciones" a la derecha', () => {
    const wrapper = montar({}, { insignia: '<span class="chip">3 registros</span>', acciones: '<button>Registrar ingreso</button>' })

    expect(wrapper.get('.encabezado__titulo-grupo').text()).toContain('3 registros')
    expect(wrapper.get('.encabezado__titulo-grupo').find('h1').exists()).toBe(true)
    expect(wrapper.get('.encabezado__acciones').text()).toBe('Registrar ingreso')
  })
})
