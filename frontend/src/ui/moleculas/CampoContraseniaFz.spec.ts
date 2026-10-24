import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CampoContraseniaFz from './CampoContraseniaFz.vue'

function montar(props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) {
  return mount(CampoContraseniaFz, {
    props: { etiqueta: 'Contraseña', modelValue: 'secreta', ...props },
    attrs,
    attachTo: document.body,
  })
}

describe('CampoContraseniaFz', () => {
  it('arranca con la contraseña oculta', () => {
    const wrapper = montar()

    expect(wrapper.get('input').attributes('type')).toBe('password')
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('false')
    wrapper.unmount()
  })

  it('el botón alterna entre type=password y type=text, con aria-pressed', async () => {
    const wrapper = montar()
    const boton = wrapper.get('button')

    await boton.trigger('click')
    expect(wrapper.get('input').attributes('type')).toBe('text')
    expect(boton.attributes('aria-pressed')).toBe('true')

    await boton.trigger('click')
    expect(wrapper.get('input').attributes('type')).toBe('password')
    expect(boton.attributes('aria-pressed')).toBe('false')
    wrapper.unmount()
  })

  it('el nombre accesible del botón es fijo y no cambia con el estado', async () => {
    const wrapper = montar()
    const boton = wrapper.get('button')

    expect(boton.attributes('aria-label')).toBe('Mostrar contraseña')
    await boton.trigger('click')
    expect(boton.attributes('aria-label')).toBe('Mostrar contraseña')
    wrapper.unmount()
  })

  it('es un botón nativo que no envía el formulario, está después del campo en el orden de tabulación y recibe foco', () => {
    const wrapper = montar()
    const input = wrapper.get('input').element
    const boton = wrapper.get('button')

    expect(boton.element.tagName).toBe('BUTTON')
    expect(boton.attributes('type')).toBe('button')
    expect(boton.attributes('tabindex')).toBeUndefined()
    expect(input.compareDocumentPosition(boton.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    ;(boton.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(boton.element)
    wrapper.unmount()
  })

  it('conserva la etiqueta asociada al campo', () => {
    const wrapper = montar({ id: 'clave' })

    expect(wrapper.get('label').attributes('for')).toBe('clave')
    expect(wrapper.get('input').attributes('id')).toBe('clave')
    expect(wrapper.get('label').text()).toBe('Contraseña')
    wrapper.unmount()
  })

  it('con error: aria-invalid, aria-describedby hacia el mensaje y el mensaje con role="alert"', () => {
    const wrapper = montar({ id: 'clave', error: 'Ingresá tu contraseña.' })
    const input = wrapper.get('input')
    const mensaje = wrapper.get('[role="alert"]')

    expect(input.attributes('aria-invalid')).toBe('true')
    expect(mensaje.text()).toBe('Ingresá tu contraseña.')
    expect(input.attributes('aria-describedby')).toContain(mensaje.attributes('id'))
    wrapper.unmount()
  })

  it('con ayuda: aria-describedby apunta a la ayuda', () => {
    const wrapper = montar({ id: 'clave', ayuda: 'Al menos 8 caracteres.' })

    const ayuda = wrapper.get('#clave-ayuda')
    expect(ayuda.text()).toBe('Al menos 8 caracteres.')
    expect(wrapper.get('input').attributes('aria-describedby')).toContain('clave-ayuda')
    wrapper.unmount()
  })

  it('sin error no hay aria-invalid ni aviso', () => {
    const wrapper = montar()

    expect(wrapper.get('input').attributes('aria-invalid')).toBeUndefined()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('pasa name y autocomplete al input', () => {
    const wrapper = montar({}, { name: 'contrasenia', autocomplete: 'current-password' })

    expect(wrapper.get('input').attributes('name')).toBe('contrasenia')
    expect(wrapper.get('input').attributes('autocomplete')).toBe('current-password')
    wrapper.unmount()
  })

  it('actualiza el v-model al escribir', async () => {
    const wrapper = montar()

    await wrapper.get('input').setValue('otra')

    expect(wrapper.emitted('update:modelValue')).toEqual([['otra']])
    wrapper.unmount()
  })
})
