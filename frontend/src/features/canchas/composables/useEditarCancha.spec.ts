import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

const mocks = vi.hoisted(() => ({ modificar: vi.fn() }))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ canchas: { modificar: mocks.modificar } }),
}))

import { ErrorApi } from '@/compartido/http/errores'
import type { Cancha } from '../services/servicioCanchas'
import { useEditarCancha } from './useEditarCancha'

const cancha: Cancha = { id: 6, sedeId: 3, tipo: 'PADDLE', costoPorHora: 5000, estado: 'OPERATIVA' }

const errorApi = (status: number, detail: string) =>
  new ErrorApi(status, detail, { type: 'about:blank', title: 'Error', status, detail })

function armar() {
  const edicion = effectScope().run(() => useEditarCancha())!
  edicion.iniciar(cancha)
  return edicion
}

describe('useEditarCancha', () => {
  beforeEach(() => {
    mocks.modificar.mockReset()
  })

  it('arranca con el costo y el estado actuales', () => {
    expect(armar().form).toEqual({ costoPorHora: '5000', estado: 'OPERATIVA' })
  })

  it('iniciar con otra cancha vuelve a cargar los valores y limpia los errores', async () => {
    const edicion = armar()
    edicion.form.costoPorHora = '-1'
    await edicion.guardar()
    expect(edicion.errores.value.costoPorHora).toBeTruthy()

    edicion.iniciar({ ...cancha, id: 9, costoPorHora: 7000, estado: 'EN_MANTENIMIENTO' })

    expect(edicion.form).toEqual({ costoPorHora: '7000', estado: 'EN_MANTENIMIENTO' })
    expect(edicion.errores.value).toEqual({})
    expect(edicion.error.value).toBeNull()
  })

  it('cambiar solo el costo manda solo el costo', async () => {
    mocks.modificar.mockResolvedValue({ ...cancha, costoPorHora: 6500 })
    const edicion = armar()
    edicion.form.costoPorHora = '6500'

    const guardada = await edicion.guardar()

    expect(guardada).toEqual({ ...cancha, costoPorHora: 6500 })
    expect(mocks.modificar).toHaveBeenCalledWith(6, { costoPorHora: 6500 })
    expect(edicion.guardando.value).toBe(false)
  })

  it('acepta un costo que llega como número', async () => {
    mocks.modificar.mockResolvedValue({ ...cancha, costoPorHora: 10000 })
    const edicion = armar()
    edicion.form.costoPorHora = 10000 as unknown as string

    await expect(edicion.guardar()).resolves.toEqual({ ...cancha, costoPorHora: 10000 })

    expect(mocks.modificar).toHaveBeenCalledWith(6, { costoPorHora: 10000 })
    expect(edicion.errores.value).toEqual({})
  })

  it('pasar a mantenimiento manda solo el estado', async () => {
    mocks.modificar.mockResolvedValue({ ...cancha, estado: 'EN_MANTENIMIENTO' })
    const edicion = armar()
    edicion.form.estado = 'EN_MANTENIMIENTO'

    await edicion.guardar()

    expect(mocks.modificar).toHaveBeenCalledWith(6, { estado: 'EN_MANTENIMIENTO' })
  })

  // Antes vivía en useGestionCanchas ("liberar el mantenimiento la vuelve operativa").
  it('liberar el mantenimiento manda solo el estado OPERATIVA', async () => {
    const enMantenimiento: Cancha = { ...cancha, estado: 'EN_MANTENIMIENTO' }
    mocks.modificar.mockResolvedValue(cancha)
    const edicion = armar()
    edicion.iniciar(enMantenimiento)
    edicion.form.estado = 'OPERATIVA'

    await expect(edicion.guardar()).resolves.toEqual(cancha)

    expect(mocks.modificar).toHaveBeenCalledWith(6, { estado: 'OPERATIVA' })
  })

  it('cambiar el costo y el estado a la vez manda los dos en un solo pedido', async () => {
    mocks.modificar.mockResolvedValue({ ...cancha, costoPorHora: 4000, estado: 'EN_MANTENIMIENTO' })
    const edicion = armar()
    edicion.form.costoPorHora = '4000'
    edicion.form.estado = 'EN_MANTENIMIENTO'

    await edicion.guardar()

    expect(mocks.modificar).toHaveBeenCalledTimes(1)
    expect(mocks.modificar).toHaveBeenCalledWith(6, { costoPorHora: 4000, estado: 'EN_MANTENIMIENTO' })
  })

  it('sin cambios no llama al servidor y lo dice dentro del modal', async () => {
    const edicion = armar()

    expect(await edicion.guardar()).toBeNull()

    expect(mocks.modificar).not.toHaveBeenCalled()
    expect(edicion.error.value).toBe('No hay cambios para guardar: modificá el costo o el estado.')
  })

  it('un costo inválido marca el campo y no llama al servidor, sin lanzar una excepción', async () => {
    const edicion = armar()

    for (const costo of ['', '-5', 'abc', null, undefined]) {
      edicion.form.costoPorHora = costo as unknown as string
      await expect(edicion.guardar()).resolves.toBeNull()
      expect(edicion.errores.value.costoPorHora).toBe('Ingresá un costo por hora de cero o más.')
    }
    expect(mocks.modificar).not.toHaveBeenCalled()
  })

  it('un 404 dice que la cancha ya no existe', async () => {
    mocks.modificar.mockRejectedValue(errorApi(404, 'No existe'))
    const edicion = armar()
    edicion.form.costoPorHora = '6000'

    expect(await edicion.guardar()).toBeNull()

    expect(edicion.error.value).toBe('La cancha ya no existe. Actualizá la lista.')
  })

  it('un 422 crudo se muestra como texto humano', async () => {
    mocks.modificar.mockRejectedValue(errorApi(422, 'costoPorHora must not be less than 0'))
    const edicion = armar()
    edicion.form.costoPorHora = '6000'

    expect(await edicion.guardar()).toBeNull()

    expect(edicion.error.value).toBe('Revisá los datos de la cancha e intentá de nuevo.')
    expect(edicion.guardando.value).toBe(false)
  })

  it('si falla sin respuesta de la API deja el texto por defecto', async () => {
    mocks.modificar.mockRejectedValue(new Error('sin conexión'))
    const edicion = armar()
    edicion.form.costoPorHora = '6000'

    await edicion.guardar()

    expect(edicion.error.value).toBe('No se pudo actualizar la cancha.')
  })
})
