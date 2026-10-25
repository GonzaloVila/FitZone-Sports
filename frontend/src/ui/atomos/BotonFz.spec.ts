import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BotonFz from './BotonFz.vue'

describe('BotonFz', () => {
  it('por defecto es un <button type="button">', () => {
    const wrapper = mount(BotonFz, { slots: { default: 'Guardar' } })

    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('con cargando queda deshabilitado y con aria-busy', () => {
    const wrapper = mount(BotonFz, { props: { cargando: true } })

    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
  })

  it('la variante advertencia agrega su clase y sigue siendo un botón normal', async () => {
    const wrapper = mount(BotonFz, { props: { variante: 'advertencia' }, slots: { default: 'Suspender' } })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['boton', 'boton--advertencia', 'boton--md']))
    expect(wrapper.attributes('type')).toBe('button')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('la variante advertencia deshabilitada no es clickeable', () => {
    const wrapper = mount(BotonFz, { props: { variante: 'advertencia' }, attrs: { disabled: '' } })

    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  it('como="a" es un enlace con aspecto de botón: lleva el href y no lleva type ni disabled', () => {
    const wrapper = mount(BotonFz, {
      props: { como: 'a', variante: 'secundario' },
      attrs: { href: '/socios/nuevo' },
      slots: { default: 'Nuevo socio' },
    })

    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toBe('/socios/nuevo')
    expect(wrapper.attributes('type')).toBeUndefined()
    expect(wrapper.attributes('disabled')).toBeUndefined()
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['boton', 'boton--secundario', 'boton--md']))
    expect(wrapper.text()).toBe('Nuevo socio')
  })

  it('como="a" reenvía el clic', async () => {
    const wrapper = mount(BotonFz, { props: { como: 'a' }, attrs: { href: '#' } })

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
