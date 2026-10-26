import { describe, expect, it } from 'vitest'

import { ErrorApi, crearErrorDeRed, crearErrorDeRespuesta, mensajeDeError } from './errores'

const problema = (detail: string, extra: object = {}) => ({
  type: 'https://fitzone.app/errores/acceso-duplicado',
  title: 'Acceso duplicado',
  status: 409,
  detail,
  ...extra,
})

describe('crearErrorDeRespuesta: mensajes sin códigos de requisito', () => {
  it('el mensaje del error y el detail del problema salen sin la referencia', () => {
    const error = crearErrorDeRespuesta(409, problema('El socio 7 ya tiene un ingreso sin egreso registrado (RN-01).'), 'Conflict')

    expect(error.message).toBe('El socio 7 ya tiene un ingreso sin egreso registrado.')
    expect(error.problema?.detail).toBe('El socio 7 ya tiene un ingreso sin egreso registrado.')
    expect(mensajeDeError(error, 'por defecto')).toBe('El socio 7 ya tiene un ingreso sin egreso registrado.')
  })

  it('también el title y cada mensaje de la lista de errores de validación (422)', () => {
    const error = crearErrorDeRespuesta(
      422,
      problema('Datos inválidos (RNF-04)', { title: 'Validación (RF-12)', errors: ['nombre must be a string (RNF-04)', 'aforoMaximo must be >= 1'] }),
      'Unprocessable Entity',
    )

    expect(error.problema?.title).toBe('Validación')
    expect(error.problema?.errors).toEqual(['nombre must be a string', 'aforoMaximo must be >= 1'])
  })

  it('sin detail usa el title (ya limpio) como mensaje', () => {
    const error = crearErrorDeRespuesta(409, problema('', { title: 'Aforo lleno (RF-05)' }), 'Conflict')

    expect(error.message).toBe('Aforo lleno')
  })

  it('un mensaje sin códigos queda exactamente igual, y el resto del problema no se toca', () => {
    const error = crearErrorDeRespuesta(409, problema('La sede 3 alcanzó su aforo máximo (50 personas).', { instance: '/ingresos' }), 'Conflict')

    expect(error.message).toBe('La sede 3 alcanzó su aforo máximo (50 personas).')
    expect(error.problema).toMatchObject({ type: 'https://fitzone.app/errores/acceso-duplicado', status: 409, instance: '/ingresos' })
    expect(error.problema && 'errors' in error.problema).toBe(false)
  })

  it('una respuesta que no es problem+json usa el texto de estado, y un texto plano se limpia igual', () => {
    expect(crearErrorDeRespuesta(500, null, 'Internal Server Error').message).toBe('Internal Server Error')
    expect(crearErrorDeRespuesta(409, 'Ya existe (RN-01).', 'Conflict').message).toBe('Ya existe.')
  })

  it('los errores de red y el status siguen igual', () => {
    expect(crearErrorDeRed()).toBeInstanceOf(ErrorApi)
    expect(crearErrorDeRespuesta(404, problema('No existe'), 'Not Found').status).toBe(404)
  })
})
