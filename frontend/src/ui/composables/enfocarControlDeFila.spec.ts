import { afterEach, describe, expect, it } from 'vitest'

import { enfocarControlDeFila } from './enfocarControlDeFila'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('enfocarControlDeFila', () => {
  it('con íconos, enfoca el botón de la acción pedida', () => {
    document.body.innerHTML = `
      <button data-identificador="fila-7-pagar"></button>
      <button data-identificador="fila-7-cancelar"></button>`

    expect(enfocarControlDeFila('fila-7', 'cancelar')).toBe(true)
    expect(document.activeElement?.getAttribute('data-identificador')).toBe('fila-7-cancelar')
  })

  it('si esa acción ya no existe en la fila, enfoca el primer control que siga existiendo', () => {
    document.body.innerHTML = `
      <button data-identificador="fila-7-ver"></button>
      <button data-identificador="fila-7-cancelar"></button>`

    expect(enfocarControlDeFila('fila-7', 'pagar')).toBe(true)
    expect(document.activeElement?.getAttribute('data-identificador')).toBe('fila-7-ver')
  })

  it('salta los controles deshabilitados (no pueden recibir el foco)', () => {
    document.body.innerHTML = `
      <button data-identificador="fila-7-pagar" disabled></button>
      <button data-identificador="fila-7-cancelar"></button>`

    expect(enfocarControlDeFila('fila-7', 'pagar')).toBe(true)
    expect(document.activeElement?.getAttribute('data-identificador')).toBe('fila-7-cancelar')
  })

  it('con el menú, enfoca el disparador (su identificador es el de la fila)', () => {
    document.body.innerHTML = '<button data-identificador="menu-socio-3"></button>'

    expect(enfocarControlDeFila('menu-socio-3', 'cambiar-plan')).toBe(true)
    expect(document.activeElement?.getAttribute('data-identificador')).toBe('menu-socio-3')
  })

  it('no confunde una fila con otra cuyo identificador empieza igual', () => {
    document.body.innerHTML = '<button data-identificador="fila-70-ver"></button>'

    expect(enfocarControlDeFila('fila-7', 'ver')).toBe(false)
  })

  it('si no hay ningún control devuelve false', () => {
    expect(enfocarControlDeFila('fila-1')).toBe(false)
  })
})
