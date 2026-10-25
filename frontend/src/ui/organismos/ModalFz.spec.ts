import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import ModalFz from './ModalFz.vue'

// jsdom no implementa <dialog>.showModal(): se completa con lo mínimo para que quede "abierto".
beforeAll(() => {
  const dialogo = HTMLDialogElement.prototype
  dialogo.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialogo.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

afterEach(() => {
  document.body.innerHTML = ''
})

function montar(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(ModalFz, {
    props: { modelValue: true, titulo: 'Anular pago', ...props },
    slots: { default: '<p>Contenido</p>', ...slots },
    attachTo: document.body,
  })
}

describe('ModalFz', () => {
  it('el diálogo se nombra con el título (aria-labelledby)', () => {
    const wrapper = montar()
    const titulo = wrapper.get('h2')

    expect(titulo.text()).toBe('Anular pago')
    expect(wrapper.get('dialog').attributes('aria-labelledby')).toBe(titulo.attributes('id'))
    wrapper.unmount()
  })

  it('sin descripción no hay subtítulo ni aria-describedby; con ella, el diálogo la referencia', async () => {
    const wrapper = montar()
    expect(wrapper.find('.modal__descripcion').exists()).toBe(false)
    expect(wrapper.get('dialog').attributes('aria-describedby')).toBeUndefined()

    await wrapper.setProps({ descripcion: 'Esta acción no se puede deshacer.' })
    const descripcion = wrapper.get('.modal__descripcion')
    expect(descripcion.text()).toBe('Esta acción no se puede deshacer.')
    expect(wrapper.get('dialog').attributes('aria-describedby')).toBe(descripcion.attributes('id'))
    wrapper.unmount()
  })

  it('el ícono es opcional, decorativo y toma la clase del tono (neutro por defecto)', async () => {
    const wrapper = montar()
    expect(wrapper.find('.modal__icono').exists()).toBe(false)

    await wrapper.setProps({ icono: 'advertencia' })
    const caja = wrapper.get('.modal__icono')
    expect(caja.attributes('aria-hidden')).toBe('true')
    expect(caja.classes()).toContain('modal__icono--neutro')

    for (const tono of ['primario', 'advertencia', 'peligro'] as const) {
      await wrapper.setProps({ tono })
      expect(wrapper.get('.modal__icono').classes()).toContain(`modal__icono--${tono}`)
    }
    wrapper.unmount()
  })

  it('el ancho es normal por defecto y acepta angosto y amplio', async () => {
    const wrapper = montar()
    expect(wrapper.get('dialog').classes()).toContain('modal--normal')

    await wrapper.setProps({ ancho: 'angosto' })
    expect(wrapper.get('dialog').classes()).toContain('modal--angosto')
    await wrapper.setProps({ ancho: 'amplio' })
    expect(wrapper.get('dialog').classes()).toContain('modal--amplio')
    wrapper.unmount()
  })

  it('el botón Cerrar es un botón con nombre accesible y cierra el modal', async () => {
    const wrapper = montar()
    const cerrar = wrapper.get('header button')

    expect(cerrar.attributes('aria-label')).toBe('Cerrar')
    expect(cerrar.attributes('type')).toBe('button')
    await cerrar.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    wrapper.unmount()
  })

  it('con ocupado el botón Cerrar queda deshabilitado y no cierra', async () => {
    const wrapper = montar({ ocupado: true })
    const cerrar = wrapper.get('header button')

    expect(cerrar.attributes('disabled')).toBeDefined()
    await cerrar.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('con ocupado se frena Esc (el evento cancel)', () => {
    const libre = montar()
    expect(libre.get('dialog').element.dispatchEvent(new Event('cancel', { cancelable: true }))).toBe(true)
    libre.unmount()

    const ocupado = montar({ ocupado: true })
    expect(ocupado.get('dialog').element.dispatchEvent(new Event('cancel', { cancelable: true }))).toBe(false)
    ocupado.unmount()
  })

  it('el pie existe solo si hay slot de acciones, y entrega cerrar() con la misma lógica', async () => {
    const sin = montar()
    expect(sin.find('footer').exists()).toBe(false)
    sin.unmount()

    const wrapper = mount(ModalFz, {
      props: { modelValue: true, titulo: 'Confirmar' },
      slots: {
        default: '<p>Contenido</p>',
        acciones: '<template #acciones="{ cerrar }"><button id="volver" type="button" @click="cerrar">Volver</button></template>',
      },
      attachTo: document.body,
    })
    expect(wrapper.get('footer').text()).toBe('Volver')

    await wrapper.get('#volver').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    wrapper.unmount()
  })

  describe('foco inicial', () => {
    it('va al primer control del cuerpo, no a la X', () => {
      const wrapper = montar({}, { default: '<button id="a" type="button">Uno</button><input id="b" />', acciones: '<button id="c" type="button">Aceptar</button>' })

      expect(document.activeElement?.id).toBe('a')
      wrapper.unmount()
    })

    it('sin controles en el cuerpo, va al primer botón del pie', () => {
      const wrapper = montar({}, { acciones: '<button id="cancelar" type="button">Cancelar</button><button type="button">Aceptar</button>' })

      expect(document.activeElement?.id).toBe('cancelar')
      wrapper.unmount()
    })

    it('con un grupo de radios, va al elegido', () => {
      const radios = ['a', 'b', 'c'].map((v) => `<input type="radio" name="g" value="${v}" id="r-${v}" ${v === 'b' ? 'checked' : ''} />`).join('')
      const wrapper = montar({}, { default: radios })

      expect(document.activeElement?.id).toBe('r-b')
      wrapper.unmount()
    })

    it('sin nada enfocable fuera del encabezado no fuerza el foco', () => {
      const wrapper = montar()

      expect(document.activeElement?.closest('.modal__cuerpo, .modal__pie')).toBeNull()
      wrapper.unmount()
    })
  })

  it('el contenido va en el cuerpo, entre el encabezado y el pie', () => {
    const wrapper = montar({}, { acciones: '<button type="button">Aceptar</button>' })
    const partes = [...wrapper.get('dialog').element.children].map((nodo) => nodo.tagName.toLowerCase())

    expect(partes).toEqual(['header', 'div', 'footer'])
    expect(wrapper.get('.modal__cuerpo').text()).toBe('Contenido')
    wrapper.unmount()
  })
})
