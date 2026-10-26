import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, type EffectScope } from 'vue'

vi.mock('@/compartido/servicios', async () => {
  const { serviciosMock } = await import('./altaSocioPruebas')
  return { useServicios: () => serviciosMock }
})

import { ErrorApi } from '@/compartido/http/errores'
import { error422, prepararExistente, prepararNuevo, reiniciarMocks, serviciosMock } from './altaSocioPruebas'
import { useAltaSocio } from './useAltaSocio'

let scope: EffectScope

function armar() {
  scope = effectScope()
  return scope.run(() => useAltaSocio())!
}

const { usuarios, socios } = serviciosMock

describe('useAltaSocio: los errores del servidor', () => {
  beforeEach(reiniciarMocks)
  afterEach(() => scope?.stop())

  it('un 409 de DNI repetido se muestra junto al DNI con texto propio y el modal vuelve al paso 1', async () => {
    usuarios.crear.mockRejectedValue(new ErrorApi(409, 'Duplicate key value on dni'))
    const alta = armar()
    prepararNuevo(alta)
    expect(alta.paso.value).toBe('plan')

    expect(await alta.enviar()).toBeNull()

    expect(alta.paso.value).toBe('datos')
    expect(alta.errores.value.dni).toBe('Ya existe un usuario con ese DNI.')
    expect(alta.errorGeneral.value).toBe('Revisá los datos marcados.')
    expect(socios.crear).not.toHaveBeenCalled()
    expect(alta.modo.value).toBe('nuevo')
  })

  it('un 409 de correo repetido se muestra junto al correo con texto propio y vuelve al paso 1', async () => {
    usuarios.crear.mockRejectedValue(new ErrorApi(409, 'El email ya está registrado'))
    const alta = armar()
    prepararNuevo(alta)

    await alta.enviar()

    expect(alta.paso.value).toBe('datos')
    expect(alta.errores.value.email).toBe('Ya existe un usuario con ese correo.')
    expect(alta.errorGeneral.value).toBe('Revisá los datos marcados.')
  })

  it('el error del servidor sobre un campo se borra apenas se lo corrige, y no bloquea "Continuar" una vez corregido', async () => {
    usuarios.crear.mockRejectedValue(new ErrorApi(409, 'Ya existe un usuario con ese DNI'))
    const alta = armar()
    prepararNuevo(alta)
    await alta.enviar()
    expect(alta.continuar()).toBe(false)

    // La contraseña se borró con el envío: hay que volver a escribirla.
    alta.datosNuevo.dni = '35123457'
    alta.datosNuevo.contrasenia = 'Clave-Segura-123'
    await nextTick()

    expect(alta.errores.value.dni).toBeUndefined()
    expect(alta.continuar()).toBe(true)
  })

  it('tras un envío fallido la contraseña queda vacía pero sin error (solo la ayuda neutra) hasta volver a intentar continuar', async () => {
    usuarios.crear.mockRejectedValue(new ErrorApi(409, 'Duplicate key value on dni'))
    const alta = armar()
    prepararNuevo(alta)
    await alta.enviar()

    expect(alta.datosNuevo.contrasenia).toBe('')
    expect(alta.errores.value.dni).toBeDefined()
    expect(alta.errores.value.contrasenia).toBeUndefined()

    // Al intentar continuar de nuevo, el campo vacío sí se marca (y no se avanza).
    expect(alta.continuar()).toBe(false)
    expect(alta.errores.value.contrasenia).toBe('Ingresá una contraseña.')
  })

  it('la contraseña vacía tras el fallo no se marca aunque se corrija otro campo, y vuelve a marcarse si se escribe y se borra', async () => {
    usuarios.crear.mockRejectedValue(new ErrorApi(409, 'Duplicate key value on dni'))
    const alta = armar()
    prepararNuevo(alta)
    await alta.enviar()

    alta.datosNuevo.dni = '35123457'
    await nextTick()
    expect(alta.errores.value.contrasenia).toBeUndefined()

    alta.datosNuevo.contrasenia = 'abc'
    await nextTick()
    expect(alta.errores.value.contrasenia).toBe('La contraseña debe tener al menos 8 caracteres.')
    alta.datosNuevo.contrasenia = ''
    await nextTick()
    expect(alta.errores.value.contrasenia).toBe('Ingresá una contraseña.')
  })

  it('un error del servidor sobre la contraseña (422) sí se muestra aunque esté vacía', async () => {
    usuarios.crear.mockRejectedValue(error422(['contrasenia is too weak']))
    const alta = armar()
    prepararNuevo(alta)
    await alta.enviar()

    expect(alta.errores.value.contrasenia).toBe('contrasenia is too weak')
  })

  it('un 422 por campo se reparte y devuelve al paso 1', async () => {
    usuarios.crear.mockRejectedValue(error422(['dni must match "^\\d{7,20}$"', 'contrasenia is too short']))
    const alta = armar()
    prepararNuevo(alta)

    await alta.enviar()

    expect(alta.paso.value).toBe('datos')
    expect(Object.keys(alta.errores.value).sort()).toEqual(['contrasenia', 'dni'])
    expect(alta.errorGeneral.value).toBe('Revisá los datos marcados.')
  })

  it('un 422 solo sobre el plan se queda en el paso 2', async () => {
    socios.crear.mockRejectedValue(error422(['plan must be one of MENSUAL, TRIMESTRAL, ANUAL']))
    const alta = armar()
    prepararExistente(alta)

    await alta.enviar()

    expect(alta.paso.value).toBe('plan')
    expect(alta.errores.value.plan).toBeDefined()
  })

  it('un 422 sobre la sede o el usuario devuelve al paso 1', async () => {
    socios.crear.mockRejectedValue(error422(['sedeOrigenId must be >= 1']))
    const alta = armar()
    prepararExistente(alta)

    await alta.enviar()

    expect(alta.paso.value).toBe('datos')
    expect(alta.errores.value.sede).toBe('sedeOrigenId must be >= 1')
  })

  it('un error general (sin campo) queda dentro del modal y no cambia de paso', async () => {
    socios.crear.mockRejectedValue(new ErrorApi(409, 'El usuario ya es socio'))
    const alta = armar()
    prepararExistente(alta)

    expect(await alta.enviar()).toBeNull()

    expect(alta.paso.value).toBe('plan')
    expect(alta.errorGeneral.value).toBe('El usuario ya es socio')
    expect(alta.enviando.value).toBe(false)
  })

  it('un error que no es del contrato usa el texto por defecto de cada llamada', async () => {
    usuarios.crear.mockRejectedValue(new Error('caída'))
    const alta = armar()
    prepararNuevo(alta)
    await alta.enviar()
    expect(alta.errorGeneral.value).toBe('No se pudo crear el usuario.')

    scope.stop()
    const otra = armar()
    socios.crear.mockRejectedValue(new Error('caída'))
    prepararExistente(otra)
    await otra.enviar()
    expect(otra.errorGeneral.value).toBe('No se pudo dar de alta al socio.')
  })
})
