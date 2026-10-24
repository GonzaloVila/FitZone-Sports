import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PlantillaCentradaFz from './PlantillaCentradaFz.vue'

describe('PlantillaCentradaFz', () => {
  it('con el slot marca lo dibuja dentro de la tarjeta, arriba del encabezado', () => {
    const wrapper = mount(PlantillaCentradaFz, {
      props: { titulo: 'Iniciar sesión', subtitulo: 'Ingresá tus credenciales.' },
      slots: { marca: '<span>Marca</span>', default: '<p>Contenido</p>' },
    })

    const marca = wrapper.get('.plantilla-centrada__tarjeta > .plantilla-centrada__marca')
    const encabezado = wrapper.get('.plantilla-centrada__encabezado')

    expect(marca.text()).toBe('Marca')
    expect(marca.element.compareDocumentPosition(encabezado.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(wrapper.get('h1').text()).toBe('Iniciar sesión')
    expect(wrapper.text()).toContain('Contenido')
  })

  it('sin el slot marca no hay contenedor vacío', () => {
    const wrapper = mount(PlantillaCentradaFz, {
      props: { titulo: 'Iniciar sesión' },
      slots: { default: '<p>Contenido</p>' },
    })

    expect(wrapper.find('.plantilla-centrada__marca').exists()).toBe(false)
    expect(wrapper.get('h1').text()).toBe('Iniciar sesión')
  })
})
