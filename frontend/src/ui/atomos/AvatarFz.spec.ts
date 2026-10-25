import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AvatarFz from './AvatarFz.vue'

function iniciales(nombre: string) {
  return mount(AvatarFz, { props: { nombre } }).text()
}

describe('AvatarFz', () => {
  it('con dos palabras muestra la primera letra de cada una', () => {
    expect(iniciales('Camila Domínguez')).toBe('CD')
  })

  it('con más de dos palabras usa solo las dos primeras', () => {
    expect(iniciales('Juan Carlos Pérez')).toBe('JC')
  })

  it('con una sola palabra muestra solo su primera letra', () => {
    expect(iniciales('Camila')).toBe('C')
  })

  it('ignora espacios de más (al inicio, al final y entre palabras)', () => {
    expect(iniciales('   camila    domínguez  ')).toBe('CD')
    expect(iniciales('  Camila  ')).toBe('C')
  })

  it('pasa a mayúsculas', () => {
    expect(iniciales('camila domínguez')).toBe('CD')
  })

  it('soporta acentos y la Ñ', () => {
    expect(iniciales('álvaro ñandú')).toBe('ÁÑ')
    expect(iniciales('Óscar Núñez')).toBe('ÓN')
    expect(iniciales('ñoño')).toBe('Ñ')
  })

  it('conserva el acento aunque venga descompuesto (letra + marca combinante)', () => {
    expect(iniciales('ángel')).toBe('Á')
  })

  it('con el nombre vacío o solo espacios muestra un carácter neutro', () => {
    expect(iniciales('')).toBe('?')
    expect(iniciales('   ')).toBe('?')
  })

  it('es decorativo: aria-hidden="true"', () => {
    const wrapper = mount(AvatarFz, { props: { nombre: 'Camila Domínguez' } })

    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })

  it('el tamaño por defecto es md y acepta sm', () => {
    const porDefecto = mount(AvatarFz, { props: { nombre: 'Camila' } })
    const chico = mount(AvatarFz, { props: { nombre: 'Camila', tamano: 'sm' } })

    expect(porDefecto.classes()).toContain('avatar--md')
    expect(chico.classes()).toContain('avatar--sm')
    expect(chico.classes()).not.toContain('avatar--md')
  })
})
