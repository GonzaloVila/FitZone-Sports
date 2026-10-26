import { beforeEach, describe, expect, it, vi } from 'vitest'
import { limpiarPenalidadCobrada, usePenalidadCobrada } from '@/compartido/composables/usePenalidadCobrada'

const mocks = vi.hoisted(() => ({
  listarPagos: vi.fn(),
  descargarComprobante: vi.fn(),
  descargar: vi.fn(),
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ pagos: { listar: mocks.listarPagos, descargarComprobante: mocks.descargarComprobante } }),
}))

vi.mock('@/features/pagos/composables/useDescargaPdf', () => ({
  useDescargaPdf: () => ({
    descargando: { value: false },
    error: { value: null },
    descargar: mocks.descargar,
  }),
}))

import { formatearHorario } from '../presentacion'
import { useAvisoPenalidad, useRegistroPenalidad } from './useAvisoPenalidad'

const CLASE = {
  id: 3,
  tipo: 'Spinning',
  horarioInicio: '2026-10-24T18:00:00-03:00',
  horarioFin: '2026-10-24T19:00:00-03:00',
}

describe('useRegistroPenalidad', () => {
  beforeEach(() => {
    limpiarPenalidadCobrada()
    mocks.listarPagos.mockReset()
  })

  it('busca el pago de la reserva, lo deja como última penalidad con su clase y devuelve el monto', async () => {
    mocks.listarPagos.mockResolvedValue({ items: [{ id: 99, monto: 5000, estado: 'APROBADO' }], total: 1 })

    const monto = await useRegistroPenalidad()(7, CLASE)

    expect(mocks.listarPagos).toHaveBeenCalledWith({ reservaClaseId: 7 }, 1, 1)
    expect(monto).toBe(5000)
    expect(usePenalidadCobrada().penalidad.value).toEqual({
      pagoId: 99,
      monto: 5000,
      clase: { id: 3, tipo: 'Spinning', horario: formatearHorario(CLASE) },
    })
  })

  it('sin la clase igual registra la penalidad', async () => {
    mocks.listarPagos.mockResolvedValue({ items: [{ id: 99, monto: 5000, estado: 'APROBADO' }], total: 1 })

    await useRegistroPenalidad()(7, null)

    expect(usePenalidadCobrada().penalidad.value).toEqual({ pagoId: 99, monto: 5000, clase: null })
  })

  it('si no hubo cobro no registra nada', async () => {
    mocks.listarPagos.mockResolvedValue({ items: [], total: 0 })

    expect(await useRegistroPenalidad()(7, CLASE)).toBeNull()
    expect(usePenalidadCobrada().penalidad.value).toBeNull()
  })

  it('si no se puede consultar el pago no registra nada y no falla', async () => {
    mocks.listarPagos.mockRejectedValue(new Error('sin conexión'))

    expect(await useRegistroPenalidad()(7, CLASE)).toBeNull()
    expect(usePenalidadCobrada().penalidad.value).toBeNull()
  })
})

describe('useAvisoPenalidad', () => {
  beforeEach(() => {
    limpiarPenalidadCobrada()
    mocks.descargar.mockReset().mockResolvedValue(true)
    mocks.descargarComprobante.mockReset()
  })

  it('sin penalidad no descarga nada', async () => {
    expect(await useAvisoPenalidad().descargarComprobante()).toBe(false)
    expect(mocks.descargar).not.toHaveBeenCalled()
  })

  it('descarga el comprobante del pago registrado, desde cualquier pantalla', async () => {
    usePenalidadCobrada().registrar({ id: 99, monto: 5000 })
    const aviso = useAvisoPenalidad()

    expect(aviso.penalidad.value?.monto).toBe(5000)
    await aviso.descargarComprobante()

    expect(mocks.descargar).toHaveBeenCalledTimes(1)
    const [nombre, obtener] = mocks.descargar.mock.calls[0] as [string, () => Promise<unknown>]
    expect(nombre).toBe('comprobante-penalidad-99.pdf')
    await obtener()
    expect(mocks.descargarComprobante).toHaveBeenCalledWith(99)
  })

  it('cerrar borra la penalidad', () => {
    usePenalidadCobrada().registrar({ id: 99, monto: 5000 })
    const aviso = useAvisoPenalidad()

    aviso.cerrar()

    expect(aviso.penalidad.value).toBeNull()
  })
})
