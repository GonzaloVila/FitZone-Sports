import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import OpcionesTarjetaFz, { type OpcionTarjetaFz } from './OpcionesTarjetaFz.vue'

const opciones: OpcionTarjetaFz[] = [
  { valor: 'MENSUAL', titulo: 'Mensual', descripcion: 'Un mes de acceso' },
  { valor: 'TRIMESTRAL', titulo: 'Trimestral', descripcion: 'Tres meses de acceso', etiqueta: 'Más elegido' },
  { valor: 'ANUAL', titulo: 'Anual' },
]

function montar(props: Record<string, unknown> = {}) {
  return mount(OpcionesTarjetaFz, {
    props: { modelValue: 'TRIMESTRAL', opciones, nombre: 'plan', leyenda: 'Plan de la membresía', ...props },
    attachTo: document.body,
  })
}

const radios = (wrapper: ReturnType<typeof montar>) => wrapper.findAll<HTMLInputElement>('input[type="radio"]')

describe('OpcionesTarjetaFz', () => {
  it('es un fieldset con su legend, que nombra al grupo', () => {
    const wrapper = montar()

    expect(wrapper.element.tagName).toBe('FIELDSET')
    expect(wrapper.get('legend').text()).toBe('Plan de la membresía')
    wrapper.unmount()
  })

  it('hay un radio nativo por opción y todos comparten el name', () => {
    const wrapper = montar()

    expect(radios(wrapper)).toHaveLength(3)
    expect(radios(wrapper).map((radio) => radio.attributes('name'))).toEqual(['plan', 'plan', 'plan'])
    expect(radios(wrapper).map((radio) => radio.element.value)).toEqual(['MENSUAL', 'TRIMESTRAL', 'ANUAL'])
    wrapper.unmount()
  })

  it('cada radio está dentro de su <label>, que es la tarjeta entera, y el texto de la tarjeta lo nombra', () => {
    const wrapper = montar()
    const tarjetas = wrapper.findAll('label')

    expect(tarjetas).toHaveLength(3)
    expect(tarjetas[0]!.find('input[type="radio"]').exists()).toBe(true)
    expect(tarjetas[0]!.text()).toContain('Mensual')
    expect(tarjetas[0]!.text()).toContain('Un mes de acceso')
    wrapper.unmount()
  })

  it('el radio elegido es el del modelValue', async () => {
    const wrapper = montar()
    expect(radios(wrapper).map((radio) => radio.element.checked)).toEqual([false, true, false])

    await wrapper.setProps({ modelValue: 'ANUAL' })
    expect(radios(wrapper).map((radio) => radio.element.checked)).toEqual([false, false, true])
    expect(wrapper.findAll('label')[2]!.classes()).toContain('opcion--elegida')
    expect(wrapper.findAll('label')[1]!.classes()).not.toContain('opcion--elegida')
    wrapper.unmount()
  })

  it('al elegir otra opción emite update:modelValue con su valor', async () => {
    const wrapper = montar()

    await radios(wrapper)[0]!.setValue(true)

    expect(wrapper.emitted('update:modelValue')).toEqual([['MENSUAL']])
    wrapper.unmount()
  })

  it('hacer clic en la tarjeta entera elige la opción', async () => {
    const wrapper = montar()

    radios(wrapper)[2]!.element.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([['ANUAL']])
    wrapper.unmount()
  })

  it('el radio sigue en el DOM y es enfocable (no se saca con display:none ni con tabindex)', () => {
    const wrapper = montar()
    const radio = radios(wrapper)[1]!

    expect(radio.attributes('tabindex')).toBeUndefined()
    radio.element.focus()
    expect(document.activeElement).toBe(radio.element)
    wrapper.unmount()
  })

  it('deshabilitado deshabilita todos los radios y marca las tarjetas', () => {
    const wrapper = montar({ deshabilitado: true })

    expect(radios(wrapper).every((radio) => radio.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.findAll('label').every((tarjeta) => tarjeta.classes().includes('opcion--deshabilitada'))).toBe(true)
    wrapper.unmount()
  })

  it('habilitado: ningún radio está deshabilitado', () => {
    const wrapper = montar()

    expect(radios(wrapper).some((radio) => radio.attributes('disabled') !== undefined)).toBe(false)
    wrapper.unmount()
  })

  it('muestra la etiqueta solo en las opciones que la tienen', () => {
    const wrapper = montar()
    const tarjetas = wrapper.findAll('label')

    expect(tarjetas[0]!.find('.insignia').exists()).toBe(false)
    expect(tarjetas[1]!.get('.insignia').text()).toBe('Más elegido')
    expect(tarjetas[2]!.find('.insignia').exists()).toBe(false)
    wrapper.unmount()
  })

  it('la descripción es opcional', () => {
    const wrapper = montar()

    expect(wrapper.findAll('label')[2]!.find('.opcion__descripcion').exists()).toBe(false)
    wrapper.unmount()
  })

  it('compacta: solo suma una clase al grupo; los radios y la estructura son los mismos', () => {
    const normal = montar()
    const compacta = montar({ compacta: true })

    expect(normal.classes()).not.toContain('opciones--compacta')
    expect(compacta.classes()).toContain('opciones--compacta')
    expect(compacta.element.tagName).toBe('FIELDSET')
    expect(compacta.get('legend').text()).toBe('Plan de la membresía')
    expect(radios(compacta)).toHaveLength(3)
    expect(compacta.findAll('label')).toHaveLength(3)
    normal.unmount()
    compacta.unmount()
  })

  it('compacta: elegir una fila emite update:modelValue como siempre', async () => {
    const wrapper = montar({ compacta: true })

    await radios(wrapper)[0]!.setValue(true)

    expect(wrapper.emitted('update:modelValue')).toEqual([['MENSUAL']])
    wrapper.unmount()
  })

  it('el indicador circular es decorativo', () => {
    const wrapper = montar()

    expect(wrapper.get('.opcion__indicador').attributes('aria-hidden')).toBe('true')
    wrapper.unmount()
  })
})
