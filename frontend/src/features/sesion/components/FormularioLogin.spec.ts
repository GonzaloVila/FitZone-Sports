import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import FormularioLogin from './FormularioLogin.vue'

function montar(props: { cargando?: boolean; error?: string } = {}) {
  return mount(FormularioLogin, { props })
}

type Wrapper = ReturnType<typeof montar>

async function completar(wrapper: Wrapper, email: string, contrasenia: string) {
  await wrapper.get('input[name="email"]').setValue(email)
  await wrapper.get('input[name="contrasenia"]').setValue(contrasenia)
}

const errores = (wrapper: Wrapper) => wrapper.findAll('[role="alert"]').map((nodo) => nodo.text())

describe('FormularioLogin', () => {
  it('no muestra errores de validación antes del primer envío', async () => {
    const wrapper = montar()

    await wrapper.get('input[name="email"]').setValue('no-es-un-email')
    await wrapper.get('input[name="email"]').trigger('blur')

    expect(errores(wrapper)).toEqual([])
  })

  it('con el email vacío muestra su error y no emite', async () => {
    const wrapper = montar()
    await completar(wrapper, '   ', 'secreta')

    await wrapper.get('form').trigger('submit')

    expect(errores(wrapper)).toEqual(['Ingresá tu correo.'])
    expect(wrapper.emitted('enviar')).toBeUndefined()
  })

  it('con un email inválido muestra su error y no emite', async () => {
    const wrapper = montar()
    await completar(wrapper, 'ana@fitzone', 'secreta')

    await wrapper.get('form').trigger('submit')

    expect(errores(wrapper)).toEqual(['Ingresá un correo válido.'])
    expect(wrapper.get('input[name="email"]').attributes('aria-invalid')).toBe('true')
    expect(wrapper.emitted('enviar')).toBeUndefined()
  })

  it('con la contraseña vacía muestra su error y no emite', async () => {
    const wrapper = montar()
    await completar(wrapper, 'ana@fitzone.com', '')

    await wrapper.get('form').trigger('submit')

    expect(errores(wrapper)).toEqual(['Ingresá tu contraseña.'])
    expect(wrapper.get('input[name="contrasenia"]').attributes('aria-invalid')).toBe('true')
    expect(wrapper.emitted('enviar')).toBeUndefined()
  })

  it('con todo vacío muestra los dos errores', async () => {
    const wrapper = montar()

    await wrapper.get('form').trigger('submit')

    expect(errores(wrapper)).toEqual(['Ingresá tu correo.', 'Ingresá tu contraseña.'])
  })

  it('un envío válido emite enviar con el email recortado y la contraseña tal cual', async () => {
    const wrapper = montar()
    await completar(wrapper, '  ana@fitzone.com  ', ' secreta ')

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('enviar')).toEqual([[{ email: 'ana@fitzone.com', contrasenia: ' secreta ' }]])
    expect(errores(wrapper)).toEqual([])
  })

  it('usa la etiqueta "Correo electrónico" y los autocomplete de un formulario de acceso', () => {
    const wrapper = montar()

    expect(wrapper.get('label[for]').text()).toBe('Correo electrónico')
    expect(wrapper.get('input[name="email"]').attributes('autocomplete')).toBe('username')
    expect(wrapper.get('input[name="contrasenia"]').attributes('autocomplete')).toBe('current-password')
    expect(wrapper.get('input[name="email"]').attributes('placeholder')).toBeUndefined()
    expect(wrapper.get('form').attributes('novalidate')).toBeDefined()
  })

  it('muestra el aviso de error recibido por prop, antes de los campos', () => {
    const wrapper = montar({ error: 'El correo o la contraseña no son correctos.' })

    const aviso = wrapper.get('[role="alert"]')
    const primerCampo = wrapper.get('input')

    expect(aviso.text()).toBe('El correo o la contraseña no son correctos.')
    expect(aviso.element.compareDocumentPosition(primerCampo.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('sin error por prop no hay aviso', () => {
    expect(montar().find('[role="alert"]').exists()).toBe(false)
  })

  it('con cargando el botón queda inerte, muestra "Ingresando…" y no dispara envíos', async () => {
    const wrapper = montar({ cargando: true })
    await completar(wrapper, 'ana@fitzone.com', 'secreta')
    const boton = wrapper.get('button[type="submit"]')

    await boton.trigger('click')

    expect(boton.text()).toBe('Ingresando…')
    expect(boton.attributes('disabled')).toBeDefined()
    expect(boton.attributes('aria-busy')).toBe('true')
    expect(wrapper.emitted('enviar')).toBeUndefined()
  })

  it('sin cargando el botón dice "Ingresar" y está habilitado', () => {
    const boton = montar().get('button[type="submit"]')

    expect(boton.text()).toBe('Ingresar')
    expect(boton.attributes('disabled')).toBeUndefined()
  })
})
