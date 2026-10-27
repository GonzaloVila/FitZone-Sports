import { describe, expect, it } from 'vitest'
import { ErrorApi } from '@/compartido/http/errores'
import { mensajeCancelacion, mensajeCancha, mensajeReserva } from './errores'

const errorApi = (status: number, detail: string, type = 'about:blank') =>
  new ErrorApi(status, detail, { type, title: 'Error', status, detail })

const crudo422 = errorApi(422, 'costoPorHora must be a positive number')

describe('mensajes de error de canchas', () => {
  it('un 422 crudo no se muestra: queda un texto humano', () => {
    for (const mensaje of [mensajeReserva(crudo422), mensajeCancelacion(crudo422), mensajeCancha(crudo422, 'x')]) {
      expect(mensaje).not.toMatch(/must be/)
    }
    expect(mensajeReserva(crudo422)).toBe('No se pudo reservar ese turno. Probá con otro horario.')
    expect(mensajeCancha(crudo422, 'x')).toBe('Revisá los datos de la cancha e intentá de nuevo.')
  })

  it('los 409 se distinguen por type', () => {
    expect(mensajeReserva(errorApi(409, 'x', 'https://fitzone.app/errores/turno-ocupado'))).toBe(
      'Ese turno acaba de ser tomado, elegí otro.',
    )
    expect(mensajeCancelacion(errorApi(409, 'x', 'https://fitzone.app/errores/reserva-pasada'))).toBe(
      'El turno ya comenzó: no se puede cancelar.',
    )
  })

  it('lo que no es de la API usa el texto por defecto', () => {
    expect(mensajeReserva(new Error('boom'))).toBe('No se pudo reservar el turno.')
    expect(mensajeCancelacion(new Error('boom'))).toBe('No se pudo cancelar la reserva.')
    expect(mensajeCancha(new Error('boom'), 'No se pudo crear la cancha.')).toBe('No se pudo crear la cancha.')
  })
})
