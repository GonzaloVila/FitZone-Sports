import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'

vi.mock('@/compartido/servicios', async () => {
  const { serviciosMock } = await import('./altaSocioPruebas')
  return { useServicios: () => serviciosMock }
})

import { ErrorApi } from '@/compartido/http/errores'
import type { Usuario } from '@/features/usuarios/services/servicioUsuarios'
import {
  completarDatos,
  diferida,
  prepararExistente,
  prepararNuevo,
  reiniciarMocks,
  serviciosMock,
  socioCreado,
  usuarioCreado,
} from './altaSocioPruebas'
import { useAltaSocio } from './useAltaSocio'

let scope: EffectScope

function armar() {
  scope = effectScope()
  return scope.run(() => useAltaSocio())!
}

const { usuarios, socios } = serviciosMock

describe('useAltaSocio: el envío', () => {
  beforeEach(reiniciarMocks)
  afterEach(() => scope?.stop())

  it('con el paso 1 inválido no envía nada y vuelve al paso 1', async () => {
    const alta = armar()
    prepararNuevo(alta)
    alta.datosNuevo.dni = '123'

    expect(await alta.enviar()).toBeNull()

    expect(alta.paso.value).toBe('datos')
    expect(alta.errores.value.dni).toBeDefined()
    expect(usuarios.crear).not.toHaveBeenCalled()
    expect(socios.crear).not.toHaveBeenCalled()
  })

  it('sin plan no envía nada y muestra el error del plan en el paso 2', async () => {
    const alta = armar()
    completarDatos(alta)
    alta.continuar()

    expect(await alta.enviar()).toBeNull()

    expect(alta.paso.value).toBe('plan')
    expect(alta.errores.value).toEqual({ plan: 'Elegí un plan.' })
    expect(usuarios.crear).not.toHaveBeenCalled()
  })

  it('usuario nuevo: crea el usuario EXTERNO con los datos recortados (sin teléfono si está vacío) y después el socio', async () => {
    const alta = armar()
    prepararNuevo(alta)

    const socio = await alta.enviar()

    expect(socio).toEqual(socioCreado)
    expect(usuarios.crear).toHaveBeenCalledWith({
      rol: 'EXTERNO',
      dni: '35123456',
      nombre: 'Ana Gómez',
      email: 'ana.gomez@fitzone.com',
      contrasenia: 'Clave-Segura-123',
    })
    expect(socios.crear).toHaveBeenCalledWith({ usuarioId: 201, sedeOrigenId: 2, plan: 'MENSUAL' })
    expect(alta.enviando.value).toBe(false)
  })

  it('con teléfono lo manda recortado', async () => {
    const alta = armar()
    prepararNuevo(alta)
    alta.datosNuevo.telefono = ' 1155550000 '

    await alta.enviar()

    expect(usuarios.crear.mock.calls[0]![0]).toMatchObject({ telefono: '1155550000' })
  })

  it('usuario existente: no crea ningún usuario, da de alta al elegido', async () => {
    const alta = armar()
    prepararExistente(alta, 'ANUAL')

    expect(await alta.enviar()).toEqual(socioCreado)

    expect(usuarios.crear).not.toHaveBeenCalled()
    expect(socios.crear).toHaveBeenCalledWith({ usuarioId: 77, sedeOrigenId: 1, plan: 'ANUAL' })
  })

  it('la contraseña se borra de la memoria después de cada envío: si salió bien y si salió mal', async () => {
    const alta = armar()
    prepararNuevo(alta)
    await alta.enviar()
    expect(alta.datosNuevo.contrasenia).toBe('')

    scope.stop()
    const otra = armar()
    usuarios.crear.mockRejectedValue(new ErrorApi(409, 'Ya existe un usuario con ese DNI'))
    prepararNuevo(otra)
    await otra.enviar()
    expect(otra.datosNuevo.contrasenia).toBe('')
  })

  it('la contraseña también se borra al salir del scope', () => {
    const alta = armar()
    alta.datosNuevo.contrasenia = 'Clave-Segura-123'

    scope.stop()

    expect(alta.datosNuevo.contrasenia).toBe('')
  })

  it('mientras envía queda en curso y no lanza un segundo envío', async () => {
    const creacion = diferida<Usuario>()
    usuarios.crear.mockReturnValue(creacion.promesa)
    const alta = armar()
    prepararNuevo(alta)

    const primero = alta.enviar()
    expect(alta.enviando.value).toBe(true)
    expect(await alta.enviar()).toBeNull()
    creacion.resolver(usuarioCreado)
    await primero

    expect(usuarios.crear).toHaveBeenCalledTimes(1)
    expect(socios.crear).toHaveBeenCalledTimes(1)
  })
})

describe('useAltaSocio: el usuario se creó pero el alta falló', () => {
  beforeEach(() => {
    reiniciarMocks()
    socios.crear.mockReset().mockRejectedValueOnce(new ErrorApi(500, 'Falló el servidor')).mockResolvedValue(socioCreado)
  })
  afterEach(() => scope?.stop())

  it('el usuario queda elegido en "Ya tiene cuenta", marcado como creado recién, y el mensaje lo aclara', async () => {
    const alta = armar()
    prepararNuevo(alta)

    expect(await alta.enviar()).toBeNull()

    expect(alta.modo.value).toBe('existente')
    expect(alta.seleccionado.value).toEqual(usuarioCreado)
    expect(alta.creadoAhora.value).toBe(true)
    expect(alta.errorGeneral.value).toContain('El usuario ya se creó')
    expect(alta.errorGeneral.value).toContain('Falló el servidor')
    expect(alta.errorGeneral.value).toContain('sin volver a crearlo')
    expect(alta.paso.value).toBe('plan')
  })

  it('un reintento no vuelve a crear el usuario y da de alta al socio', async () => {
    const alta = armar()
    prepararNuevo(alta)
    await alta.enviar()

    const socio = await alta.enviar()

    expect(socio).toEqual(socioCreado)
    expect(usuarios.crear).toHaveBeenCalledTimes(1)
    expect(socios.crear).toHaveBeenCalledTimes(2)
    expect(socios.crear.mock.calls[1]![0]).toEqual({ usuarioId: 201, sedeOrigenId: 2, plan: 'MENSUAL' })
  })

  it('la contraseña ya se borró y el reintento no la necesita', async () => {
    const alta = armar()
    prepararNuevo(alta)
    await alta.enviar()

    expect(alta.datosNuevo.contrasenia).toBe('')
    expect(alta.errores.value.contrasenia).toBeUndefined()
  })

  it('"Elegir otro" desmarca el usuario creado', async () => {
    const alta = armar()
    prepararNuevo(alta)
    await alta.enviar()

    alta.quitarSeleccion()

    expect(alta.seleccionado.value).toBeNull()
    expect(alta.creadoAhora.value).toBe(false)
  })
})
