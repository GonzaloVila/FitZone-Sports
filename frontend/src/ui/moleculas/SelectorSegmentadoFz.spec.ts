import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SelectorSegmentadoFz, { type OpcionSegmentadaFz } from './SelectorSegmentadoFz.vue'

const opciones: OpcionSegmentadaFz[] = [
  { valor: 'nuevo', etiqueta: 'No tiene cuenta' },
  { valor: 'existente', etiqueta: 'Ya tiene cuenta' },
]

function montar(props: Record<string, unknown> = {}) {
  return mount(SelectorSegmentadoFz, {
    props: { modelValue: 'nuevo', opciones, nombre: 'modo', leyenda: '¿El socio ya tiene cuenta?', ...props },
    attachTo: document.body,
  })
}

const radios = (wrapper: ReturnType<typeof montar>) => wrapper.findAll<HTMLInputElement>('input[type="radio"]')

describe('SelectorSegmentadoFz', () => {
  it('es un fieldset con su legend, que nombra al grupo', () => {
    const wrapper = montar()

    expect(wrapper.element.tagName).toBe('FIELDSET')
    expect(wrapper.get('legend').text()).toBe('¿El socio ya tiene cuenta?')
    wrapper.unmount()
  })

  it('hay un radio nativo por opción, dentro de su label, y todos comparten el name', () => {
    const wrapper = montar()

    expect(radios(wrapper).map((radio) => radio.attributes('name'))).toEqual(['modo', 'modo'])
    expect(radios(wrapper).map((radio) => radio.element.value)).toEqual(['nuevo', 'existente'])
    expect(wrapper.findAll('label').map((label) => label.text())).toEqual(['No tiene cuenta', 'Ya tiene cuenta'])
    wrapper.unmount()
  })

  it('el radio marcado es el del modelValue', () => {
    const wrapper = montar({ modelValue: 'existente' })

    expect(radios(wrapper).map((radio) => radio.element.checked)).toEqual([false, true])
    wrapper.unmount()
  })

  it('al elegir otra opción emite update:modelValue con su valor', async () => {
    const wrapper = montar()

    await radios(wrapper)[1]!.setValue(true)

    expect(wrapper.emitted('update:modelValue')).toEqual([['existente']])
    wrapper.unmount()
  })

  it('deshabilitado: el fieldset lo está (y con él sus radios)', () => {
    const wrapper = montar({ deshabilitado: true })

    expect(wrapper.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
