import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CampoTextoFz from './CampoTextoFz.vue'

describe('CampoTextoFz', () => {
  it('sin ícono es un <input> suelto: la raíz es el input y recibe los atributos', () => {
    const wrapper = mount(CampoTextoFz, { props: { modelValue: '' }, attrs: { id: 'nombre', class: 'mio' } })

    expect(wrapper.element.tagName).toBe('INPUT')
    expect(wrapper.attributes('id')).toBe('nombre')
    expect(wrapper.classes()).toContain('mio')
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('con ícono lo muestra decorativo y deja el input con los atributos y su clase', () => {
    const wrapper = mount(CampoTextoFz, {
      props: { modelValue: '', icono: 'buscar', tipo: 'search' },
      attrs: { 'aria-label': 'Buscar', placeholder: 'Buscar…', class: 'mio' },
    })
    const input = wrapper.get('input')

    expect(wrapper.find('svg').attributes('aria-hidden')).toBe('true')
    expect(input.attributes('type')).toBe('search')
    expect(input.attributes('aria-label')).toBe('Buscar')
    expect(input.attributes('placeholder')).toBe('Buscar…')
    expect(input.classes()).toEqual(expect.arrayContaining(['campo', 'campo--md', 'campo--con-icono', 'mio']))
  })

  it('con ícono sigue actualizando el v-model', async () => {
    const wrapper = mount(CampoTextoFz, { props: { modelValue: '', icono: 'buscar' } })

    await wrapper.get('input').setValue('ana')

    expect(wrapper.emitted('update:modelValue')).toEqual([['ana']])
  })
})
