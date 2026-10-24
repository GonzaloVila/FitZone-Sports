import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MarcaFz from './MarcaFz.vue'

describe('MarcaFz', () => {
  it('muestra el nombre y, por defecto, la primera letra en mayúscula como inicial', () => {
    const wrapper = mount(MarcaFz, { props: { nombre: 'fitZone Sports' } })

    expect(wrapper.get('.marca__nombre').text()).toBe('fitZone Sports')
    expect(wrapper.get('.marca__logo').text()).toBe('F')
  })

  it('usa la inicial recibida cuando se la pasa', () => {
    const wrapper = mount(MarcaFz, { props: { nombre: 'FitZone Sports', inicial: 'z' } })

    expect(wrapper.get('.marca__logo').text()).toBe('Z')
  })

  it('el cuadradito es decorativo (aria-hidden)', () => {
    const wrapper = mount(MarcaFz, { props: { nombre: 'FitZone' } })

    expect(wrapper.get('.marca__logo').attributes('aria-hidden')).toBe('true')
  })

  it('la descripción es opcional y lleva el texto completo en el title', () => {
    const sin = mount(MarcaFz, { props: { nombre: 'FitZone' } })
    const con = mount(MarcaFz, { props: { nombre: 'FitZone', descripcion: 'Sede Centro' } })

    expect(sin.find('.marca__descripcion').exists()).toBe(false)
    expect(con.get('.marca__descripcion').text()).toBe('Sede Centro')
    expect(con.get('.marca__descripcion').attributes('title')).toBe('Sede Centro')
  })
})
