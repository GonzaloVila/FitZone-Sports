import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CampoFormularioFz from './CampoFormularioFz.vue'

function montar(props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
  return mount(CampoFormularioFz, { props: { etiqueta: 'Nombre y apellido', modelValue: '', ...props }, slots: slots as never })
}

describe('CampoFormularioFz', () => {
  it('la etiqueta se asocia al campo con for/id y no lleva asterisco por defecto', () => {
    const wrapper = montar()
    const campo = wrapper.get('input')

    expect(wrapper.get('label').attributes('for')).toBe(campo.attributes('id'))
    expect(wrapper.get('label').text()).toBe('Nombre y apellido')
    expect(wrapper.find('.campo-formulario__asterisco').exists()).toBe(false)
    expect(campo.attributes('aria-required')).toBeUndefined()
  })

  it('obligatorio: asterisco decorativo en la etiqueta y aria-required en el campo', () => {
    const wrapper = montar({ obligatorio: true })

    expect(wrapper.get('.campo-formulario__asterisco').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('input').attributes('aria-required')).toBe('true')
  })

  it('etiquetaChica solo agrega la clase del tamaño mínimo', () => {
    expect(montar().get('label').classes()).not.toContain('campo-formulario__etiqueta--chica')
    expect(montar({ etiquetaChica: true }).get('label').classes()).toContain('campo-formulario__etiqueta--chica')
  })

  it('con contenido propio no dibuja el campo de texto y le pasa el id y el aria-describedby (ayuda y error)', () => {
    const wrapper = mount(CampoFormularioFz, {
      props: { etiqueta: 'Sede de origen', ayuda: 'Se puede cambiar después.', error: 'Elegí la sede.' },
      slots: {
        default: `<template #default="{ id, describedby, invalido }"><select :id="id" :aria-describedby="describedby" :aria-invalid="invalido"><option>Centro</option></select></template>`,
      },
    })
    const select = wrapper.get('select')

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.get('label').attributes('for')).toBe(select.attributes('id'))
    expect(select.attributes('aria-describedby')?.split(' ')).toHaveLength(2)
    expect(select.attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('[role="alert"]').text()).toBe('Elegí la sede.')
  })
})
