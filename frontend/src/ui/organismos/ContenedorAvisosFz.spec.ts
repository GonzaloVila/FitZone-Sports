import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAvisosFz } from '../composables/useAvisosFz'
import ContenedorAvisosFz from './ContenedorAvisosFz.vue'

const avisos = useAvisosFz()

const cuerpo = () => document.body.textContent ?? ''
const botonesCerrar = () => [...document.body.querySelectorAll<HTMLButtonElement>('button[aria-label="Cerrar aviso"]')]

describe('ContenedorAvisosFz', () => {
  beforeEach(() => {
    avisos.cerrarTodos()
  })

  afterEach(() => {
    avisos.cerrarTodos()
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('muestra un aviso con título y descripción cuando se agrega, y el viewport con su etiqueta', async () => {
    const wrapper = mount(ContenedorAvisosFz, { attachTo: document.body })

    avisos.exito('Socio guardado', 'Quedó registrado en la sede Centro')

    await vi.waitFor(() => expect(cuerpo()).toContain('Socio guardado'))
    expect(cuerpo()).toContain('Quedó registrado en la sede Centro')
    expect(document.body.querySelector('[aria-label="Avisos (F8)"]')).not.toBeNull()
    wrapper.unmount()
  })

  it('el botón "Cerrar aviso" lo saca de la pantalla', async () => {
    const wrapper = mount(ContenedorAvisosFz, { attachTo: document.body })
    avisos.info('Sincronizando')
    await vi.waitFor(() => expect(botonesCerrar()).toHaveLength(1))

    botonesCerrar()[0]!.click()

    await vi.waitFor(() => expect(cuerpo()).not.toContain('Sincronizando'))
    expect(avisos.avisos.value).toHaveLength(0)
    wrapper.unmount()
  })

  it('muestra varios avisos a la vez, cada uno con su botón de cerrar', async () => {
    const wrapper = mount(ContenedorAvisosFz, { attachTo: document.body })

    avisos.exito('Uno')
    avisos.error('Dos')

    await vi.waitFor(() => expect(botonesCerrar()).toHaveLength(2))
    wrapper.unmount()
  })

  it('se cierra solo a los 5 s (éxito) y a los 8 s (error), con el reloj simulado', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ContenedorAvisosFz, { attachTo: document.body })

    avisos.exito('Listo')
    avisos.error('Falló')
    await vi.advanceTimersByTimeAsync(10)
    expect(cuerpo()).toContain('Listo')
    expect(cuerpo()).toContain('Falló')

    await vi.advanceTimersByTimeAsync(5000)
    expect(cuerpo()).not.toContain('Listo')
    expect(cuerpo()).toContain('Falló')

    await vi.advanceTimersByTimeAsync(3000)
    expect(cuerpo()).not.toContain('Falló')
    wrapper.unmount()
  })
})
