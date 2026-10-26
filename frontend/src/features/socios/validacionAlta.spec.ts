import { describe, expect, it } from 'vitest'

import { ErrorApi, type Problema } from '@/compartido/http/errores'
import {
  datosUsuarioVacios,
  erroresDeDatos,
  erroresDePlan,
  hayErrores,
  pasoConErrores,
  pasoDelCampo,
  repartirErroresAlta,
  type DatosUsuarioNuevo,
} from './validacionAlta'

const datosValidos: DatosUsuarioNuevo = {
  dni: '35123456',
  nombre: 'Ana Gómez',
  email: 'ana.gomez@fitzone.com',
  contrasenia: 'Clave-Segura-123',
  telefono: '',
}

const nuevo = (datos: Partial<DatosUsuarioNuevo> = {}, sede = '1') =>
  erroresDeDatos({ modo: 'nuevo', datos: { ...datosValidos, ...datos }, hayUsuario: false, sede })

function error422(errors: string[]) {
  return new ErrorApi(422, 'Datos inválidos', { title: 'Unprocessable', status: 422, detail: 'Datos inválidos', errors } as Problema)
}

describe('erroresDeDatos: usuario nuevo', () => {
  it('con todo bien no hay errores (el teléfono es opcional)', () => {
    expect(nuevo()).toEqual({})
  })

  it('formulario vacío: faltan DNI, nombre, correo, contraseña y sede', () => {
    const errores = erroresDeDatos({ modo: 'nuevo', datos: datosUsuarioVacios(), hayUsuario: false, sede: '' })

    expect(Object.keys(errores).sort()).toEqual(['contrasenia', 'dni', 'email', 'nombre', 'sede'])
  })

  it.each([
    ['1234567', true],
    ['12345678901234567890', true],
    ['123456', false],
    ['123456789012345678901', false],
    ['12.345.678', false],
    ['1234 5678', false],
    ['12345abc', false],
  ])('DNI %s: %s', (dni, valido) => {
    expect(nuevo({ dni }).dni === undefined).toBe(valido)
  })

  it('el DNI se recorta antes de validar', () => {
    expect(nuevo({ dni: ' 35123456 ' }).dni).toBeUndefined()
  })

  it.each([
    ['ana@fitzone.com', true],
    ['ana@fitzone', false],
    ['ana fitzone.com', false],
    ['@fitzone.com', false],
    ['', false],
  ])('correo %j: %s', (email, valido) => {
    expect(nuevo({ email }).email === undefined).toBe(valido)
  })

  it('contraseña vacía: pide ingresarla', () => {
    expect(nuevo({ contrasenia: '' }).contrasenia).toBe('Ingresá una contraseña.')
  })

  it('contraseña de 1 a 7 caracteres: pide al menos 8', () => {
    for (const contrasenia of ['1', '1234567']) {
      expect(nuevo({ contrasenia }).contrasenia).toBe('La contraseña debe tener al menos 8 caracteres.')
    }
  })

  it('con 8 caracteres o más no hay error (sin recortar: los espacios cuentan)', () => {
    expect(nuevo({ contrasenia: '12345678' }).contrasenia).toBeUndefined()
    expect(nuevo({ contrasenia: '        ' }).contrasenia).toBeUndefined()
  })

  it('el nombre con solo espacios falta', () => {
    expect(nuevo({ nombre: '   ' }).nombre).toBeDefined()
  })

  it('la sede es obligatoria', () => {
    expect(nuevo({}, '').sede).toBeDefined()
  })

  it('lo escrito en el otro modo no cuenta: con un usuario nuevo no se pide haber elegido uno', () => {
    expect(nuevo().usuario).toBeUndefined()
  })
})

describe('erroresDeDatos: usuario existente', () => {
  it('hay que elegir un usuario, y no se piden los datos del nuevo aunque estén vacíos', () => {
    const errores = erroresDeDatos({ modo: 'existente', datos: datosUsuarioVacios(), hayUsuario: false, sede: '1' })

    expect(errores).toEqual({ usuario: 'Elegí un usuario.' })
  })

  it('con un usuario elegido y la sede no hay errores; sin sede, falta la sede', () => {
    expect(erroresDeDatos({ modo: 'existente', datos: datosUsuarioVacios(), hayUsuario: true, sede: '1' })).toEqual({})
    expect(erroresDeDatos({ modo: 'existente', datos: datosUsuarioVacios(), hayUsuario: true, sede: '' })).toEqual({
      sede: 'Elegí la sede de origen.',
    })
  })
})

describe('erroresDePlan', () => {
  it('acepta los tres planes del contrato y pide elegir uno', () => {
    for (const plan of ['MENSUAL', 'TRIMESTRAL', 'ANUAL']) expect(erroresDePlan(plan)).toEqual({})
    expect(erroresDePlan('')).toEqual({ plan: 'Elegí un plan.' })
    expect(erroresDePlan('SEMESTRAL')).toEqual({ plan: 'Elegí un plan.' })
  })
})

describe('pasos y campos', () => {
  it('todos los campos son del paso 1 salvo el plan', () => {
    for (const campo of ['dni', 'nombre', 'email', 'contrasenia', 'telefono', 'usuario', 'sede'] as const) {
      expect(pasoDelCampo(campo)).toBe('datos')
    }
    expect(pasoDelCampo('plan')).toBe('plan')
  })

  it('pasoConErrores: el 1 si algún error es de sus campos, el 2 si solo es el plan, ninguno si no hay', () => {
    expect(pasoConErrores({ dni: 'x', plan: 'y' })).toBe('datos')
    expect(pasoConErrores({ sede: 'x' })).toBe('datos')
    expect(pasoConErrores({ plan: 'y' })).toBe('plan')
    expect(pasoConErrores({})).toBeNull()
  })

  it('hayErrores', () => {
    expect(hayErrores({})).toBe(false)
    expect(hayErrores({ dni: 'x' })).toBe(true)
  })
})

describe('repartirErroresAlta', () => {
  it('un 409 que nombra el DNI o el correo va junto a ese campo (usuario nuevo), con texto propio del front', () => {
    expect(repartirErroresAlta(new ErrorApi(409, 'Duplicate key value on dni'), 'nuevo', 'Falló').campos).toEqual({
      dni: 'Ya existe un usuario con ese DNI.',
    })
    expect(repartirErroresAlta(new ErrorApi(409, 'El email ya está registrado'), 'nuevo', 'Falló').campos).toEqual({
      email: 'Ya existe un usuario con ese correo.',
    })
    expect(repartirErroresAlta(new ErrorApi(409, 'Ese correo ya está en uso'), 'nuevo', 'Falló').campos).toEqual({
      email: 'Ya existe un usuario con ese correo.',
    })
  })

  it('el mensaje crudo del backend no aparece ni en el campo ni en el error general', () => {
    const { campos, general } = repartirErroresAlta(new ErrorApi(409, 'Duplicate key value on dni'), 'nuevo', 'Falló')

    expect(JSON.stringify(campos)).not.toContain('Duplicate')
    expect(general).toBe('Revisá los datos marcados.')
  })

  it('con el correo y el DNI en el mensaje gana el correo (como siempre)', () => {
    expect(Object.keys(repartirErroresAlta(new ErrorApi(409, 'email o dni repetido'), 'nuevo', 'Falló').campos)).toEqual(['email'])
  })

  it('un 409 sin campo, o en el modo "existente", es un error general', () => {
    expect(repartirErroresAlta(new ErrorApi(409, 'El usuario ya es socio'), 'nuevo', 'Falló')).toEqual({
      campos: {},
      general: 'El usuario ya es socio',
    })
    expect(repartirErroresAlta(new ErrorApi(409, 'Ya existe un usuario con ese DNI'), 'existente', 'Falló')).toEqual({
      campos: {},
      general: 'Ya existe un usuario con ese DNI',
    })
  })

  it('un 422 se reparte por campo del contrato (usuarioId y sedeOrigenId incluidos) y el general invita a revisar', () => {
    const { campos, general } = repartirErroresAlta(
      error422(['dni must match "^\\d{7,20}$"', 'sedeOrigenId must be >= 1', 'usuarioId is required']),
      'nuevo',
      'Falló',
    )

    expect(Object.keys(campos).sort()).toEqual(['dni', 'sede', 'usuario'])
    expect(general).toBe('Revisá los datos marcados.')
  })

  it('un 422 con propiedades desconocidas las deja en el error general', () => {
    const { campos, general } = repartirErroresAlta(error422(['nombre is blank', 'fotoUrl is invalid']), 'nuevo', 'Falló')

    expect(campos).toEqual({ nombre: 'nombre is blank' })
    expect(general).toBe('fotoUrl is invalid')
  })

  it('un 422 sin detalle y cualquier otro error del contrato van al general con su mensaje', () => {
    expect(repartirErroresAlta(new ErrorApi(422, 'Datos inválidos'), 'nuevo', 'Falló')).toEqual({ campos: {}, general: 'Datos inválidos' })
    expect(repartirErroresAlta(new ErrorApi(500, 'Falló el servidor'), 'nuevo', 'x')).toEqual({ campos: {}, general: 'Falló el servidor' })
  })

  it('un error que no es del contrato usa el texto por defecto', () => {
    expect(repartirErroresAlta(new Error('caída'), 'nuevo', 'No se pudo crear el usuario.')).toEqual({
      campos: {},
      general: 'No se pudo crear el usuario.',
    })
  })
})
