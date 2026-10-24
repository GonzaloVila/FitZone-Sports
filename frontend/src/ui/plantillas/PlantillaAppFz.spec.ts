import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PlantillaAppFz from './PlantillaAppFz.vue'

const slots = {
  encabezado: '<span>Marca</span>',
  navegacion: '<a href="#socios">Socios</a>',
  acciones: '<span>Acciones</span>',
  pie: '<span>Usuario</span>',
  default: '<p>Contenido</p>',
}

function montarLateral() {
  return mount(PlantillaAppFz, { props: { disposicion: 'barra-lateral' }, slots, attachTo: document.body })
}

describe('PlantillaAppFz con disposicion="barra-lateral"', () => {
  it('renderiza todos los slots y la navegación con su etiqueta', () => {
    const wrapper = montarLateral()

    for (const texto of ['Marca', 'Socios', 'Acciones', 'Usuario', 'Contenido']) {
      expect(wrapper.text()).toContain(texto)
    }
    expect(wrapper.find('nav').attributes('aria-label')).toBe('Navegación principal')
    expect(wrapper.find('.armazon__pie').text()).toBe('Usuario')
    wrapper.unmount()
  })

  it('el botón Menú alterna aria-expanded y su texto accesible', async () => {
    const wrapper = montarLateral()
    const boton = wrapper.find('button.armazon__menu')
    const idPanel = boton.attributes('aria-controls')

    expect(boton.attributes('aria-expanded')).toBe('false')
    expect(boton.attributes('aria-label')).toBe('Abrir menú')
    expect(wrapper.find(`[id="${idPanel}"]`).exists()).toBe(true)

    await boton.trigger('click')
    expect(boton.attributes('aria-expanded')).toBe('true')
    expect(boton.attributes('aria-label')).toBe('Cerrar menú')

    await boton.trigger('click')
    expect(boton.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('se cierra con Escape devolviendo el foco al botón, y al activar un enlace', async () => {
    const wrapper = montarLateral()
    const boton = wrapper.find('button.armazon__menu')

    await boton.trigger('click')
    await wrapper.find('nav a').trigger('keydown', { key: 'Escape' })
    expect(boton.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(boton.element)

    await boton.trigger('click')
    await wrapper.find('nav a').trigger('click')
    expect(boton.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })
})

describe('PlantillaAppFz con la disposición por defecto', () => {
  it('conserva la barra superior: sin botón Menú ni pie', () => {
    const wrapper = mount(PlantillaAppFz, { slots })

    expect(wrapper.find('header.armazon__encabezado').exists()).toBe(true)
    expect(wrapper.find('button.armazon__menu').exists()).toBe(false)
    expect(wrapper.find('.armazon__pie').exists()).toBe(false)
    expect(wrapper.text()).toContain('Acciones')
    wrapper.unmount()
  })
})
