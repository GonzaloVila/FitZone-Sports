import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import FiltrosSocios from './FiltrosSocios.vue'

const sedes = [
  { id: 1, nombre: 'Centro', direccion: 'Av. Colón 100', aforoMaximo: 100 },
  { id: 2, nombre: 'Norte', direccion: 'Av. Colón 200', aforoMaximo: 80 },
]

function montar(props: { hayFiltrosActivos?: boolean } = {}) {
  return mount(FiltrosSocios, {
    props: {
      nombre: '',
      estado: '',
      plan: '',
      sede: '',
      sedes,
      hayFiltrosActivos: false,
      ...props,
    },
  })
}

const opciones = (select: ReturnType<ReturnType<typeof montar>['get']>) =>
  select.findAll('option').map((opcion) => opcion.text())

describe('FiltrosSocios', () => {
  it('el buscador tiene placeholder, nombre accesible y la lupa decorativa', () => {
    const buscador = montar().get('input[type="search"]')

    expect(buscador.attributes('placeholder')).toBe('Buscar por nombre…')
    expect(buscador.attributes('aria-label')).toBe('Buscar socio por nombre')
    expect(montar().get('svg').attributes('aria-hidden')).toBe('true')
  })

  it('escribir en el buscador actualiza el nombre', async () => {
    const wrapper = montar()

    await wrapper.get('input[type="search"]').setValue('ana')

    expect(wrapper.emitted('update:nombre')).toEqual([['ana']])
  })

  it('no ofrece exportar', () => {
    const wrapper = montar({ hayFiltrosActivos: true })

    expect(wrapper.text()).not.toMatch(/exportar/i)
    expect(wrapper.find('[title*="CSV"]').exists()).toBe(false)
  })

  it('los selects no tienen etiqueta visible: cada uno lleva su nombre accesible', () => {
    const wrapper = montar()

    expect(wrapper.find('label').exists()).toBe(false)
    expect(wrapper.get('select[name="estado"]').attributes('aria-label')).toBe('Estado de la membresía')
    expect(wrapper.get('select[name="plan"]').attributes('aria-label')).toBe('Plan')
    expect(wrapper.get('select[name="sede"]').attributes('aria-label')).toBe('Sede de origen')
  })

  it('la primera opción de cada select es "Todos…" con valor vacío', () => {
    const wrapper = montar()
    const primeras = ['estado', 'plan', 'sede'].map((nombre) => wrapper.get(`select[name="${nombre}"] option`))

    expect(primeras.map((opcion) => opcion.text())).toEqual(['Todos los estados', 'Todos los planes', 'Todas las sedes'])
    expect(primeras.map((opcion) => opcion.attributes('value'))).toEqual(['', '', ''])
  })

  it('las opciones salen del contrato y de las sedes recibidas', () => {
    const wrapper = montar()

    expect(opciones(wrapper.get('select[name="estado"]'))).toEqual(['Todos los estados', 'Activa', 'Vencida', 'Suspendida'])
    expect(opciones(wrapper.get('select[name="plan"]'))).toEqual(['Todos los planes', 'Mensual', 'Trimestral', 'Anual'])
    expect(opciones(wrapper.get('select[name="sede"]'))).toEqual(['Todas las sedes', 'Centro', 'Norte'])
  })

  it('elegir una opción actualiza el filtro (la sede como texto)', async () => {
    const wrapper = montar()

    await wrapper.get('select[name="estado"]').setValue('ACTIVA')
    await wrapper.get('select[name="sede"]').setValue('2')

    expect(wrapper.emitted('update:estado')).toEqual([['ACTIVA']])
    expect(wrapper.emitted('update:sede')).toEqual([['2']])
  })

  it('"Limpiar" solo aparece con filtros activos', () => {
    expect(montar().findAll('button').map((boton) => boton.text())).not.toContain('Limpiar')
    expect(montar({ hayFiltrosActivos: true }).findAll('button').map((boton) => boton.text())).toContain('Limpiar')
  })

  it('"Limpiar" emite limpiar', async () => {
    const wrapper = montar({ hayFiltrosActivos: true })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('limpiar')).toHaveLength(1)
  })

  it('es una región de búsqueda con nombre', () => {
    const raiz = montar().get('[role="search"]')

    expect(raiz.attributes('aria-label')).toBe('Filtros de socios')
  })
})
