import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, type EffectScope } from 'vue'

vi.mock('@/compartido/servicios', async () => {
  const { serviciosMock } = await import('./altaSocioPruebas')
  return { useServicios: () => serviciosMock }
})

import { completarDatos, prepararNuevo, reiniciarMocks, usuarioExistente } from './altaSocioPruebas'
import { useAltaSocio } from './useAltaSocio'

let scope: EffectScope

function armar() {
  scope = effectScope()
  return scope.run(() => useAltaSocio())!
}

describe('useAltaSocio: los pasos', () => {
  beforeEach(reiniciarMocks)
  afterEach(() => scope?.stop())

  it('arranca en el paso 1 con "No tiene cuenta" (usuario nuevo) y sin errores a la vista', () => {
    const alta = armar()

    expect(alta.paso.value).toBe('datos')
    expect(alta.modo.value).toBe('nuevo')
    expect(alta.errores.value).toEqual({})
    expect(alta.errorGeneral.value).toBeNull()
  })

  it('"Continuar" con el paso 1 vacío no avanza y muestra los errores de ese paso (no los del plan)', () => {
    const alta = armar()

    expect(alta.continuar()).toBe(false)

    expect(alta.paso.value).toBe('datos')
    expect(Object.keys(alta.errores.value).sort()).toEqual(['contrasenia', 'dni', 'email', 'nombre', 'sede'])
  })

  it('"Continuar" con el paso 1 válido avanza al plan', () => {
    const alta = armar()
    completarDatos(alta)

    expect(alta.continuar()).toBe(true)

    expect(alta.paso.value).toBe('plan')
    expect(alta.errores.value).toEqual({})
  })

  it('pedir la pestaña 2 con el paso 1 inválido hace lo mismo que "Continuar": valida, muestra los errores y no avanza', () => {
    const alta = armar()

    alta.irAPaso('plan')

    expect(alta.paso.value).toBe('datos')
    expect(alta.errores.value.dni).toBeDefined()
    expect(alta.errores.value.sede).toBeDefined()
  })

  it('pedir la pestaña 2 con el paso 1 válido avanza', () => {
    const alta = armar()
    completarDatos(alta)

    alta.irAPaso('plan')

    expect(alta.paso.value).toBe('plan')
  })

  it('volver al paso 1 es libre y no pierde nada de lo cargado', () => {
    const alta = armar()
    prepararNuevo(alta)

    alta.irAPaso('datos')

    expect(alta.paso.value).toBe('datos')
    expect(alta.datosNuevo.nombre).toBe(' Ana Gómez ')
    expect(alta.datosNuevo.contrasenia).toBe('Clave-Segura-123')
    expect(alta.sede.value).toBe('2')
    expect(alta.plan.value).toBe('MENSUAL')
    alta.volver()
    expect(alta.paso.value).toBe('datos')
  })

  it('cambiar de modo conserva lo escrito en cada uno', () => {
    const alta = armar()
    completarDatos(alta)
    alta.modo.value = 'existente'
    alta.busqueda.value = 'bru'
    alta.seleccionar(usuarioExistente)

    alta.modo.value = 'nuevo'
    expect(alta.datosNuevo.nombre).toBe(' Ana Gómez ')
    expect(alta.datosNuevo.dni).toBe(' 35123456 ')
    alta.modo.value = 'existente'
    expect(alta.seleccionado.value).toEqual(usuarioExistente)
    expect(alta.busqueda.value).toBe('bru')
  })

  it('"Ya tiene cuenta": hay que elegir un usuario (aunque los datos del nuevo estén bien) y la sede', () => {
    const alta = armar()
    alta.modo.value = 'existente'

    expect(alta.continuar()).toBe(false)
    expect(Object.keys(alta.errores.value).sort()).toEqual(['sede', 'usuario'])

    alta.seleccionar(usuarioExistente)
    alta.sede.value = '1'
    expect(alta.errores.value).toEqual({})
    expect(alta.continuar()).toBe(true)
  })

  it('quitar la selección ("Elegir otro") vuelve a pedir elegir un usuario', () => {
    const alta = armar()
    alta.modo.value = 'existente'
    alta.sede.value = '1'
    alta.seleccionar(usuarioExistente)
    alta.quitarSeleccion()

    expect(alta.seleccionado.value).toBeNull()
    expect(alta.continuar()).toBe(false)
    expect(alta.errores.value.usuario).toBeDefined()
  })

  it('nombreDelSocio es el del formulario (recortado) o el del usuario elegido, según el modo', () => {
    const alta = armar()
    alta.datosNuevo.nombre = '  Ana Gómez '
    expect(alta.nombreDelSocio.value).toBe('Ana Gómez')

    alta.modo.value = 'existente'
    expect(alta.nombreDelSocio.value).toBe('')
    alta.seleccionar(usuarioExistente)
    expect(alta.nombreDelSocio.value).toBe('Bruno Paz')
  })

  it('reiniciar deja todo como recién abierto', async () => {
    const alta = armar()
    prepararNuevo(alta)
    alta.modo.value = 'existente'
    alta.seleccionar(usuarioExistente)
    alta.busqueda.value = 'bru'

    alta.reiniciar()
    await nextTick()

    expect(alta.paso.value).toBe('datos')
    expect(alta.modo.value).toBe('nuevo')
    expect(alta.datosNuevo).toEqual({ dni: '', nombre: '', email: '', contrasenia: '', telefono: '' })
    expect(alta.seleccionado.value).toBeNull()
    expect(alta.creadoAhora.value).toBe(false)
    expect(alta.sede.value).toBe('')
    expect(alta.plan.value).toBe('')
    expect(alta.busqueda.value).toBe('')
    expect(alta.errores.value).toEqual({})
    expect(alta.errorGeneral.value).toBeNull()
  })
})
