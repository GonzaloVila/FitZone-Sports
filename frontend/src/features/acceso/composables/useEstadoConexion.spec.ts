import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useEstadoConexion } from './useEstadoConexion'

describe('useEstadoConexion', () => {
  it('inicializa con el estado actual de navigator.onLine y responde a eventos online/offline', async () => {
    const ComponentePrueba = defineComponent({
      setup() {
        return useEstadoConexion()
      },
      template: '<div>{{ enLinea ? "online" : "offline" }}</div>',
    })

    const wrapper = mount(ComponentePrueba)
    expect(wrapper.text()).toBe('online')

    window.dispatchEvent(new Event('offline'))
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('offline')

    window.dispatchEvent(new Event('online'))
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('online')

    wrapper.unmount()
  })
})
