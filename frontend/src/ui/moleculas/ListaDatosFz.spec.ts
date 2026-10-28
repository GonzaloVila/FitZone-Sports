import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ListaDatosFz from './ListaDatosFz.vue'

const DATOS = [
  { etiqueta: 'Cancha', valor: 'Fútbol 5 #2' },
  { etiqueta: 'Precio base por hora', valor: '$ 4.000,00', destacado: true },
]

describe('ListaDatosFz', () => {
  it('es una lista de definición con un término y un valor por dato, en orden', () => {
    const wrapper = mount(ListaDatosFz, { props: { datos: DATOS } })

    expect(wrapper.element.tagName).toBe('DL')
    expect(wrapper.findAll('dt').map((nodo) => nodo.text())).toEqual(['Cancha', 'Precio base por hora'])
    expect(wrapper.findAll('dd').map((nodo) => nodo.text())).toEqual(['Fútbol 5 #2', '$ 4.000,00'])
  })

  it('solo el dato destacado lleva la clase de énfasis', () => {
    const wrapper = mount(ListaDatosFz, { props: { datos: DATOS } })
    const valores = wrapper.findAll('dd')

    expect(valores[0]?.classes()).not.toContain('lista-datos__valor--destacado')
    expect(valores[1]?.classes()).toContain('lista-datos__valor--destacado')
  })

  it('sin datos no dibuja filas', () => {
    const wrapper = mount(ListaDatosFz, { props: { datos: [] } })

    expect(wrapper.findAll('dt')).toHaveLength(0)
  })
})
