import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AccionesFilaFz, { type AccionFilaFz } from './AccionesFilaFz.vue'

const ACCIONES: AccionFilaFz[] = [
  { clave: 'pagar', etiqueta: 'Pagar', etiquetaAccesible: 'Pagar la reserva de Fútbol 5 #2', icono: 'pagos' },
  { clave: 'cancelar', etiqueta: 'Cancelar reserva', icono: 'cerrar', peligro: true },
]

function montar(props: Partial<InstanceType<typeof AccionesFilaFz>['$props']> = {}) {
  return mount(AccionesFilaFz, {
    props: { acciones: ACCIONES, maximo: 2, etiqueta: 'Acciones de Fútbol 5 #2', identificador: 'fila-2', ...props },
  })
}

describe('AccionesFilaFz: hasta 2 acciones, botones de solo ícono', () => {
  it('es un grupo con nombre y un botón por acción', () => {
    const wrapper = montar()

    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Acciones de Fútbol 5 #2')
    expect(wrapper.findAll('button')).toHaveLength(2)
    expect(wrapper.find('.menu-acciones__disparador').exists()).toBe(false)
  })

  it('cada botón tiene tooltip (etiqueta) y nombre accesible (etiquetaAccesible, o la etiqueta si no hay)', () => {
    const botones = montar().findAll('button')

    expect(botones[0]!.attributes('title')).toBe('Pagar')
    expect(botones[0]!.attributes('aria-label')).toBe('Pagar la reserva de Fútbol 5 #2')
    expect(botones[1]!.attributes('title')).toBe('Cancelar reserva')
    expect(botones[1]!.attributes('aria-label')).toBe('Cancelar reserva')
  })

  it('son botones de solo ícono: sin texto visible y con el ícono decorativo', () => {
    const boton = montar().get('button')

    expect(boton.classes()).toContain('boton--solo-icono')
    expect(boton.text()).toBe('')
    expect(boton.get('svg').attributes('aria-hidden')).toBe('true')
  })

  it('emite seleccionar con la clave de la acción', async () => {
    const wrapper = montar()

    await wrapper.findAll('button')[1]!.trigger('click')

    expect(wrapper.emitted('seleccionar')).toEqual([['cancelar']])
  })

  it('una acción deshabilitada no emite pero conserva su tooltip (también en el envoltorio)', async () => {
    const wrapper = montar({ acciones: [{ ...ACCIONES[0]!, deshabilitada: true }, ACCIONES[1]!] })
    const boton = wrapper.findAll('button')[0]!

    await boton.trigger('click')

    expect(boton.attributes('disabled')).toBeDefined()
    expect(boton.attributes('title')).toBe('Pagar')
    expect(wrapper.findAll('.acciones-fila__item')[0]!.attributes('title')).toBe('Pagar')
    expect(wrapper.emitted('seleccionar')).toBeUndefined()
  })

  it('cargando muestra el estado de carga del botón en lugar del ícono', () => {
    const wrapper = montar({ acciones: [{ ...ACCIONES[0]!, cargando: true }] })
    const boton = wrapper.get('button')

    expect(boton.attributes('aria-busy')).toBe('true')
    expect(boton.find('.boton__spinner').exists()).toBe(true)
    expect(boton.find('svg').exists()).toBe(false)
  })

  it('la acción peligrosa lleva su clase de color', () => {
    const botones = montar().findAll('button')

    expect(botones[0]!.classes()).not.toContain('acciones-fila__boton--peligro')
    expect(botones[1]!.classes()).toContain('acciones-fila__boton--peligro')
  })

  it('cada botón lleva data-identificador "<identificador>-<clave>" para devolverle el foco', () => {
    const botones = montar().findAll('button')

    expect(botones.map((boton) => boton.attributes('data-identificador'))).toEqual(['fila-2-pagar', 'fila-2-cancelar'])
  })

  it('sin identificador no escribe el atributo', () => {
    expect(montar({ identificador: undefined }).get('button').attributes('data-identificador')).toBeUndefined()
  })

  it('con una sola acción posible también son íconos', () => {
    const wrapper = montar({ acciones: [ACCIONES[0]!], maximo: 1 })

    expect(wrapper.findAll('button')).toHaveLength(1)
  })

  it('sin acciones no dibuja nada', () => {
    expect(montar({ acciones: [] }).html()).toBe('<!--v-if-->')
  })
})

describe('AccionesFilaFz: divisor corto entre íconos', () => {
  const TRES: AccionFilaFz[] = [...ACCIONES, { clave: 'ver', etiqueta: 'Ver detalle', icono: 'ojo' }]

  it('con 2 acciones hay una sola rayita, entre los dos botones', () => {
    const grupo = montar().get('[role="group"]')
    const hijos = Array.from(grupo.element.children).map((hijo) => (hijo.classList.contains('acciones-fila__divisor') ? 'divisor' : 'item'))

    expect(hijos).toEqual(['item', 'divisor', 'item'])
  })

  it('con 1 acción no hay divisor', () => {
    const wrapper = montar({ acciones: [ACCIONES[0]!], maximo: 1 })

    expect(wrapper.find('.acciones-fila__divisor').exists()).toBe(false)
  })

  it('en modo menú no hay divisor', () => {
    const wrapper = montar({ acciones: TRES, maximo: 3 })

    expect(wrapper.find('.acciones-fila__divisor').exists()).toBe(false)
  })

  it('es decorativo: oculto a los lectores de pantalla, sin rol y fuera de la cuenta de botones', () => {
    const wrapper = montar()
    const divisor = wrapper.get('.acciones-fila__divisor')

    expect(divisor.attributes('aria-hidden')).toBe('true')
    expect(divisor.attributes('role')).toBeUndefined()
    expect(divisor.text()).toBe('')
    expect(wrapper.findAll('button')).toHaveLength(2)
    expect(wrapper.findAll('[role="separator"]')).toHaveLength(0)
  })

  it('un botón deshabilitado conserva su divisor y su tooltip', () => {
    const wrapper = montar({ acciones: [ACCIONES[0]!, { ...ACCIONES[1]!, deshabilitada: true }] })

    expect(wrapper.findAll('.acciones-fila__divisor')).toHaveLength(1)
    expect(wrapper.findAll('button')[1]!.attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('.acciones-fila__item')[1]!.attributes('title')).toBe('Cancelar reserva')
  })

  it('no cambia el orden de los botones ni sus data-identificador', () => {
    const botones = montar().findAll('button')

    expect(botones.map((boton) => boton.attributes('data-identificador'))).toEqual(['fila-2-pagar', 'fila-2-cancelar'])
  })
})

describe('AccionesFilaFz: 3 o más acciones posibles, un menú', () => {
  const MUCHAS: AccionFilaFz[] = [
    { clave: 'ver', etiqueta: 'Ver detalle', icono: 'ojo' },
    { clave: 'confirmar', etiqueta: 'Confirmar cupo', icono: 'tilde' },
    { clave: 'salir', etiqueta: 'Salir de la lista', icono: 'cerrar', peligro: true, separada: true },
  ]

  it('aunque la fila tenga menos acciones, el máximo manda: dibuja el menú, con su disparador', () => {
    const wrapper = montar({ acciones: [MUCHAS[0]!], maximo: 3 })
    const disparador = wrapper.get('button.menu-acciones__disparador')

    expect(disparador.attributes('aria-label')).toBe('Acciones de Fútbol 5 #2')
    expect(wrapper.find('[role="group"]').exists()).toBe(false)
  })

  it('el disparador lleva data-identificador igual al identificador (sin clave)', () => {
    const wrapper = montar({ acciones: MUCHAS, maximo: 3 })

    expect(wrapper.get('button').attributes('data-identificador')).toBe('fila-2')
  })
})
