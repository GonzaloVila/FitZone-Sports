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

  describe('arranque y reiniciar', () => {
    it('la sede y el deporte arrancan sin elegir, sin precargar ningún valor', () => {
      expect(armar().form).toEqual({ sedeId: '', tipo: '', costoPorHora: '' })
    })

    it('reiniciar deja todo sin elegir y limpia los errores', async () => {
      const alta = armar()
      completar(alta)
      alta.form.costoPorHora = '-1'
      await alta.crear()
      alta.error.value = 'algo falló'

      alta.reiniciar()

      expect(alta.form).toEqual({ sedeId: '', tipo: '', costoPorHora: '' })
      expect(alta.errores.value).toEqual({})
      expect(alta.error.value).toBeNull()
    })
  })

  describe('crear', () => {
    it('con datos incompletos marca los campos y no llama al servidor', async () => {
      const alta = armar()

      expect(await alta.crear()).toBeNull()

      expect(mocks.crear).not.toHaveBeenCalled()
      expect(Object.keys(alta.errores.value)).toEqual(expect.arrayContaining(['sedeId', 'tipo', 'costoPorHora']))
    })

    // Criterio de los selects obligatorios: "Elegí el/la …" junto al campo, con la redacción de "Elegí la sede de origen.".
    it('sin elegir sede ni deporte pide elegirlos con un mensaje "Elegí …"', async () => {
      const alta = armar()
      alta.form.costoPorHora = '5000'

      await alta.crear()

      expect(alta.errores.value.sedeId).toBe('Elegí la sede de la cancha.')
      expect(alta.errores.value.tipo).toBe('Elegí el deporte de la cancha.')
      expect(alta.errores.value.costoPorHora).toBeUndefined()
    })

    // v-model sobre un campo type="number" entrega un NÚMERO aunque el modelo se declare como texto.
    it('acepta un costo que llega como número (como lo entrega un campo numérico)', async () => {
      mocks.crear.mockResolvedValue({ id: 9 })
      const alta = armar()
      completar(alta)
      alta.form.costoPorHora = 10000 as unknown as string

      expect(await alta.crear()).toEqual({ id: 9 })

      expect(alta.errores.value).toEqual({})
      expect(mocks.crear).toHaveBeenCalledWith(3, { tipo: 'FUTBOL5', costoPorHora: 10000, estado: 'OPERATIVA' })
    })

    it('un costo numérico de cero o negativo se valida sin lanzar una excepción', async () => {
      mocks.crear.mockResolvedValue({ id: 1 })
      const alta = armar()
      completar(alta)

      alta.form.costoPorHora = -5 as unknown as string
      await expect(alta.crear()).resolves.toBeNull()
      expect(alta.errores.value.costoPorHora).toBe('Ingresá un costo por hora de cero o más.')

      alta.form.costoPorHora = 0 as unknown as string
      await expect(alta.crear()).resolves.toEqual({ id: 1 })
      expect(alta.errores.value).toEqual({})
    })

    it('un valor vacío o nulo en el modelo es un costo faltante, no un error del programa', async () => {
      const alta = armar()
      completar(alta)

      for (const vacio of [null, undefined, '']) {
        alta.form.costoPorHora = vacio as unknown as string
        await expect(alta.crear()).resolves.toBeNull()
        expect(alta.errores.value.costoPorHora).toBe('Ingresá un costo por hora de cero o más.')
        expect(alta.error.value).toBeNull()
      }
    })

    it('el error viejo del costo se limpia cuando el valor pasa a ser válido', async () => {
      mocks.crear.mockResolvedValue({ id: 2 })
      const alta = armar()
      completar(alta)
      alta.form.costoPorHora = ''
      await alta.crear()
      expect(alta.errores.value.costoPorHora).toBeTruthy()

      alta.form.costoPorHora = 10000 as unknown as string
      await alta.crear()

      expect(alta.errores.value.costoPorHora).toBeUndefined()
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
