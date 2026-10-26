import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MedidorFz from './MedidorFz.vue'

describe('MedidorFz', () => {
  it('muestra "valor de máximo (porcentaje)" y expone la barra como progressbar con su valor', () => {
    const wrapper = mount(MedidorFz, { props: { valor: 39, maximo: 50 } })
    const barra = wrapper.get('[role="progressbar"]')

    expect(wrapper.get('.medidor-fz__texto').text()).toBe('39 de 50 (78%)')
    expect(barra.attributes('aria-valuenow')).toBe('39')
    expect(barra.attributes('aria-valuemax')).toBe('50')
    expect(wrapper.get('.medidor-fz__llenado').attributes('style')).toContain('width: 78%')
  })

  it('el porcentaje no se pasa de 0 a 100 ni se rompe con capacidad 0', () => {
    expect(mount(MedidorFz, { props: { valor: 120, maximo: 100 } }).get('.medidor-fz__texto').text()).toBe('120 de 100 (100%)')
    expect(mount(MedidorFz, { props: { valor: 3, maximo: 0 } }).get('.medidor-fz__texto').text()).toBe('3 de 0 (0%)')
  })

  it('el color lo decide quien lo usa: por defecto es "normal" y no cambia solo con el porcentaje', () => {
    const casi = mount(MedidorFz, { props: { valor: 95, maximo: 100 } })

    expect(casi.classes()).toContain('medidor-fz--normal')
  })

  it.each(['normal', 'advertencia', 'critico'] as const)('con nivel="%s" aplica ese color', (nivel) => {
    const wrapper = mount(MedidorFz, { props: { valor: 10, maximo: 100, nivel } })

    expect(wrapper.classes()).toContain(`medidor-fz--${nivel}`)
  })
})
