import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TablaFz from './TablaFz.vue'
import type { ColumnaTabla } from './tipos'

interface Fila {
  id: number
  nombre: string
  estado: string
}

const filas: Fila[] = [{ id: 1, nombre: 'Ana', estado: 'Activa' }]

function montar(columnas: ColumnaTabla[]) {
  return mount(TablaFz, {
    // El genérico del componente se infiere como object en mount().
    props: { titulo: 'Listado', columnas, filas, claveFila: (fila: object) => (fila as Fila).id },
  })
}

describe('TablaFz', () => {
  it('mantiene la región con foco, el título y el scope de encabezados y celdas', () => {
    const wrapper = montar([
      { clave: 'nombre', etiqueta: 'Nombre', encabezadoFila: true },
      { clave: 'estado', etiqueta: 'Estado' },
    ])

    expect(wrapper.attributes('role')).toBe('region')
    expect(wrapper.attributes('tabindex')).toBe('0')
    expect(wrapper.attributes('aria-label')).toBe('Listado')
    expect(wrapper.get('caption').text()).toBe('Listado')
    expect(wrapper.get('thead th').attributes('scope')).toBe('col')
    expect(wrapper.get('tbody th').attributes('scope')).toBe('row')
    expect(wrapper.get('tbody td').text()).toBe('Activa')
  })

  it('sin opciones de columna no agrega clases de ajuste ni de alineación', () => {
    const wrapper = montar([
      { clave: 'nombre', etiqueta: 'Nombre' },
      { clave: 'estado', etiqueta: 'Estado' },
    ])
    const clases = wrapper.findAll('th, td').flatMap((celda) => celda.classes())

    expect(clases.filter((clase) => /--(ajustada|centro|fin|en-lineas)$/.test(clase))).toEqual([])
  })

  it('una columna ajustada, centrada y con encabezado en líneas lo refleja en encabezado y celdas', () => {
    const wrapper = montar([
      { clave: 'nombre', etiqueta: 'Nombre' },
      { clave: 'estado', etiqueta: 'Estado civil', ajustada: true, alineacion: 'centro', encabezadoEnLineas: true },
    ])

    expect(wrapper.findAll('thead th')[1]!.classes()).toEqual(
      expect.arrayContaining(['tabla__encabezado--ajustada', 'tabla__encabezado--centro', 'tabla__encabezado--en-lineas']),
    )
    expect(wrapper.findAll('tbody td')[1]!.classes()).toEqual(
      expect.arrayContaining(['tabla__celda--ajustada', 'tabla__celda--centro']),
    )
  })

  it('alineación al fin y al inicio', () => {
    const wrapper = montar([
      { clave: 'nombre', etiqueta: 'Nombre', alineacion: 'inicio' },
      { clave: 'estado', etiqueta: 'Estado', alineacion: 'fin' },
    ])

    expect(wrapper.findAll('thead th')[0]!.classes()).not.toContain('tabla__encabezado--inicio')
    expect(wrapper.findAll('thead th')[1]!.classes()).toContain('tabla__encabezado--fin')
    expect(wrapper.findAll('tbody td')[1]!.classes()).toContain('tabla__celda--fin')
  })

  it('la celda de encabezado de fila también respeta la alineación', () => {
    const wrapper = montar([{ clave: 'nombre', etiqueta: 'Nombre', encabezadoFila: true, alineacion: 'fin' }])

    expect(wrapper.get('tbody th').classes()).toEqual(expect.arrayContaining(['tabla__celda--encabezado', 'tabla__celda--fin']))
  })
})
