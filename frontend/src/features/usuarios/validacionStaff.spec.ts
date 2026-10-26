import { describe, expect, it } from 'vitest'
import { ErrorApi } from '@/compartido/http/errores'
import {
  datosStaffVacios,
  erroresDeDatos,
  hayErrores,
  repartirErroresStaff,
  type DatosStaff,
} from './validacionStaff'

const validos = (): DatosStaff => ({
  ...datosStaffVacios(),
  nombre: 'Ana Gómez',
  dni: '35123456',
  email: 'ana@fitzone.com.ar',
  telefono: '+54 351 555-1234',
  contrasenia: 'Clave-Segura-123',
  sedeId: '5',
})

const errorApi = (status: number, detail: string, errors?: string[]) =>
  new ErrorApi(status, detail, {
    type: 'about:blank',
    title: 'Error',
    status,
    detail,
    ...(errors ? { errors } : {}),
  })

describe('erroresDeDatos', () => {
  it('acepta un recepcionista con todos los datos y sede', () => {
    expect(hayErrores(erroresDeDatos(validos()))).toBe(false)
  })

  it('exige la sede de trabajo', () => {
    expect(erroresDeDatos({ ...validos(), sedeId: '' })).toEqual({
      sedeId: 'Elegí la sede de trabajo.',
    })
  })

  it('valida nombre, DNI, correo, teléfono y contraseña con los límites del contrato', () => {
    const errores = erroresDeDatos({
      ...validos(),
      nombre: ' ',
      dni: '12-345.678',
      email: 'ana@',
      telefono: '1'.repeat(21),
      contrasenia: 'corta',
    })

    expect(errores.nombre).toBe('Ingresá el nombre y apellido.')
    expect(errores.dni).toContain('7 y 20 dígitos')
    expect(errores.email).toBe('Ingresá un correo válido.')
    expect(errores.telefono).toContain('20 caracteres')
    expect(errores.contrasenia).toContain('8 caracteres')
  })

  it('rechaza un nombre de más de 100 caracteres', () => {
    expect(erroresDeDatos({ ...validos(), nombre: 'a'.repeat(101) }).nombre).toContain('100')
  })
})

describe('repartirErroresStaff', () => {
  it('reparte un 422 de validación por propiedad', () => {
    const e = errorApi(422, 'Datos inválidos', [
      'email must be an email',
      'sedeId must be a positive number',
      'algo inesperado',
    ])

    expect(repartirErroresStaff(e, 'fallback')).toEqual({
      campos: {
        email: 'email must be an email',
        sedeId: 'sedeId must be a positive number',
      },
      general: 'algo inesperado',
    })
  })

  it('un 422 de negocio sin `errors` se ubica por la palabra del detail', () => {
    const sinSede = errorApi(422, 'Un recepcionista necesita una sede de trabajo.')
    expect(repartirErroresStaff(sinSede, 'fallback')).toEqual({
      campos: { sedeId: 'Un recepcionista necesita una sede de trabajo.' },
      general: null,
    })
  })

  it('mapea los 409 de unicidad al campo que corresponde', () => {
    const sede = errorApi(409, 'La sede 462 ya tiene un recepcionista asignado.')
    expect(repartirErroresStaff(sede, 'fallback')).toEqual({
      campos: { sedeId: 'La sede 462 ya tiene un recepcionista asignado.' },
      general: null,
    })

    const email = errorApi(409, 'Ya existe un usuario con el email ana@fitzone.com.ar')
    expect(repartirErroresStaff(email, 'fallback').campos.email).toBe('Ya existe un usuario con ese correo.')

    const dni = errorApi(409, 'Ya existe un usuario con el DNI 35123456')
    expect(repartirErroresStaff(dni, 'fallback').campos.dni).toBe('Ya existe un usuario con ese DNI.')
  })

  it('un 409 sin campo reconocible queda como error general', () => {
    const e = errorApi(409, 'Conflicto inesperado.')
    expect(repartirErroresStaff(e, 'fallback')).toEqual({ campos: {}, general: 'Conflicto inesperado.' })
  })

  it('un error que no es de la API usa el mensaje por defecto', () => {
    expect(repartirErroresStaff(new Error('boom'), 'No se pudo crear.')).toEqual({
      campos: {},
      general: 'No se pudo crear.',
    })
  })
})
