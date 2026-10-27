import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

const mocks = vi.hoisted(() => ({ crear: vi.fn() }))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ canchas: { crear: mocks.crear } }),
}))

import { ErrorApi } from '@/compartido/http/errores'
import { useAltaCancha } from './useAltaCancha'

const errorApi = (status: number, detail: string) =>
  new ErrorApi(status, detail, { type: 'about:blank', title: 'Error', status, detail })

function armar() {
  return effectScope().run(() => useAltaCancha())!
}

function completar(alta: ReturnType<typeof armar>) {
  alta.form.sedeId = '3'
  alta.form.tipo = 'FUTBOL5'
  alta.form.costoPorHora = '5000'
}

describe('useAltaCancha', () => {
  beforeEach(() => {
    mocks.crear.mockReset()
  })

  describe('reiniciar', () => {
    it('arranca en la sede que se le pasa, con Paddle y sin costo', () => {
      const alta = armar()
      completar(alta)

      alta.reiniciar(5)

      expect(alta.form).toEqual({ sedeId: '5', tipo: 'PADDLE', costoPorHora: '' })
    })

    it('sin sede activa todavía queda sin elegir y limpia los errores', async () => {
      const alta = armar()
      await alta.crear()
      alta.error.value = 'algo falló'

      alta.reiniciar(null)

      expect(alta.form.sedeId).toBe('')
      expect(alta.errores.value).toEqual({})
      expect(alta.error.value).toBeNull()
    })
  })

  describe('crear', () => {
    it('con datos incompletos marca los campos y no llama al servidor', async () => {
      const alta = armar()

      expect(await alta.crear()).toBeNull()

      expect(mocks.crear).not.toHaveBeenCalled()
      expect(Object.keys(alta.errores.value)).toEqual(expect.arrayContaining(['sedeId', 'costoPorHora']))
    })

    it('un costo vacío, negativo o que no es un número es inválido', async () => {
      const alta = armar()
      completar(alta)

      for (const costo of ['', '  ', '-1', 'abc']) {
        alta.form.costoPorHora = costo
        await alta.crear()
        expect(alta.errores.value.costoPorHora).toBeTruthy()
      }
      expect(mocks.crear).not.toHaveBeenCalled()
    })

    it('un costo de cero es válido (el contrato pide mínimo 0)', async () => {
      mocks.crear.mockResolvedValue({ id: 1 })
      const alta = armar()
      completar(alta)
      alta.form.costoPorHora = '0'

      expect(await alta.crear()).toEqual({ id: 1 })
    })

    it('crea la cancha operativa en la sede elegida y la devuelve', async () => {
      mocks.crear.mockResolvedValue({ id: 8, sedeId: 3 })
      const alta = armar()
      completar(alta)

      const creada = await alta.crear()

      expect(creada).toEqual({ id: 8, sedeId: 3 })
      expect(mocks.crear).toHaveBeenCalledWith(3, { tipo: 'FUTBOL5', costoPorHora: 5000, estado: 'OPERATIVA' })
      expect(alta.guardando.value).toBe(false)
    })

    it('un 404 marca la sede', async () => {
      mocks.crear.mockRejectedValue(errorApi(404, 'Sede inexistente'))
      const alta = armar()
      completar(alta)

      expect(await alta.crear()).toBeNull()

      expect(alta.errores.value.sedeId).toBe('La sede elegida no existe.')
      expect(alta.error.value).toBeNull()
    })

    it('un 422 crudo se muestra como texto humano, para el modal', async () => {
      mocks.crear.mockRejectedValue(errorApi(422, 'costoPorHora must not be less than 0'))
      const alta = armar()
      completar(alta)

      expect(await alta.crear()).toBeNull()

      expect(alta.error.value).toBe('Revisá los datos de la cancha e intentá de nuevo.')
      expect(alta.guardando.value).toBe(false)
    })

    it('si falla sin respuesta de la API deja el texto por defecto', async () => {
      mocks.crear.mockRejectedValue(new Error('sin conexión'))
      const alta = armar()
      completar(alta)

      await alta.crear()

      expect(alta.error.value).toBe('No se pudo crear la cancha.')
    })
  })
})
