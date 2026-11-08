import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ModalEscanearQr from './ModalEscanearQr.vue'

describe('ModalEscanearQr', () => {
  it('renderiza cuando abierto es true', () => {
    const wrapper = mount(ModalEscanearQr, {
      props: {
        abierto: true,
      },
      global: {
        stubs: {
          ModalFz: {
            template: '<div class="modal-stub"><slot /></div>',
          },
          SelectFz: true,
          AvisoFz: true,
          BotonFz: true,
        },
      },
    })

    expect(wrapper.find('.escaner-qr').exists()).toBe(true)
    expect(wrapper.find('#lector-qr-acceso').exists()).toBe(true)
  })

  it('no muestra el contenido si abierto es false', () => {
    const wrapper = mount(ModalEscanearQr, {
      props: {
        abierto: false,
      },
      global: {
        stubs: {
          ModalFz: {
            template: '<div v-if="$attrs.modelValue" class="modal-stub"><slot /></div>',
          },
        },
      },
    })

    expect(wrapper.find('.escaner-qr').exists()).toBe(false)
  })
})
