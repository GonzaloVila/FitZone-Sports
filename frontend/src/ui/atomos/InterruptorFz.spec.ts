import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import InterruptorFz from './InterruptorFz.vue'

function montar(props: Record<string, unknown> = {}) {
  return mount(InterruptorFz, {
    props: { etiqueta: 'Notificaciones', modelValue: false, ...props },
    attachTo: document.body,
  })
}

describe('InterruptorFz', () => {
  it('es un <button type="button"> con role="switch" y aria-checked según modelValue', async () => {
    const wrapper = montar()
    const boton = wrapper.get('button')

    expect(boton.attributes('type')).toBe('button')
    expect(boton.attributes('role')).toBe('switch')
    expect(boton.attributes('aria-checked')).toBe('false')

    await wrapper.setProps({ modelValue: true })
    expect(boton.attributes('aria-checked')).toBe('true')
    wrapper.unmount()
  })

  it('su nombre accesible es la etiqueta', () => {
    const wrapper = montar({ etiqueta: 'Activar a Camila Domínguez' })

    expect(wrapper.get('button').attributes('aria-label')).toBe('Activar a Camila Domínguez')
    wrapper.unmount()
  })

  it('al hacer clic emite update:modelValue con el valor contrario', async () => {
    const apagado = montar({ modelValue: false })
    await apagado.get('button').trigger('click')
    expect(apagado.emitted('update:modelValue')).toEqual([[true]])
    apagado.unmount()

    const encendido = montar({ modelValue: true })
    await encendido.get('button').trigger('click')
    expect(encendido.emitted('update:modelValue')).toEqual([[false]])
    encendido.unmount()
  })

  it('no muta el estado mostrado: lo decide el padre', async () => {
    const wrapper = montar({ modelValue: false })
    const boton = wrapper.get('button')

    await boton.trigger('click')
    expect(boton.attributes('aria-checked')).toBe('false')
    expect(boton.classes()).not.toContain('interruptor--encendido')

    await wrapper.setProps({ modelValue: true })
    expect(boton.attributes('aria-checked')).toBe('true')
    expect(boton.classes()).toContain('interruptor--encendido')
    wrapper.unmount()
  })

  it('es un botón nativo (Espacio y Enter lo activan), sin tabindex propio y con foco', async () => {
    const wrapper = montar()
    const boton = wrapper.get('button')

    // jsdom no convierte la tecla en clic: lo hace el navegador con cualquier <button> nativo.
    expect(boton.element.tagName).toBe('BUTTON')
    expect(boton.attributes('tabindex')).toBeUndefined()

    ;(boton.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(boton.element)

    // El clic que genera el navegador al pulsar Espacio o Enter es el que emite.
    await boton.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    wrapper.unmount()
  })

  it('deshabilitado no emite y deja el botón deshabilitado', async () => {
    const wrapper = montar({ deshabilitado: true })
    const boton = wrapper.get('button')

    expect(boton.attributes('disabled')).toBeDefined()
    await boton.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('ocupado no emite (ni clic ni teclado) y pone aria-busy', async () => {
    const wrapper = montar({ ocupado: true })
    const boton = wrapper.get('button')

    expect(boton.attributes('aria-busy')).toBe('true')
    await boton.trigger('click')
    await boton.trigger('keydown', { key: 'Enter' })
    await boton.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('sin ocupado no hay aria-busy', () => {
    const wrapper = montar()

    expect(wrapper.get('button').attributes('aria-busy')).toBeUndefined()
    wrapper.unmount()
  })

  it('el botón es la raíz: recibe los atributos que se le pasan', () => {
    const wrapper = mount(InterruptorFz, {
      props: { etiqueta: 'Notificaciones', modelValue: false },
      attrs: { id: 'avisos' },
    })

    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('id')).toBe('avisos')
    wrapper.unmount()
  })

  it('la pista y la perilla son decorativas', () => {
    const wrapper = montar()

    expect(wrapper.get('.interruptor__pista').attributes('aria-hidden')).toBe('true')
    wrapper.unmount()
  })
})
