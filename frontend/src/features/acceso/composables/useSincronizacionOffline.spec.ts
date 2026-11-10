import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useSincronizacionOffline } from './useSincronizacionOffline'
import type { ServicioAcceso } from '../services/servicioAcceso'

const mockSincronizarIngresos = vi.fn()

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({
    acceso: {
      sincronizarIngresos: mockSincronizarIngresos,
    } as unknown as ServicioAcceso,
  }),
}))

describe('useSincronizacionOffline', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('agrega accesos a la cola y los persiste en localStorage', () => {
    const sedeId = ref(1)
    const { cola, agregarAccesoOffline } = useSincronizacionOffline(sedeId)

    agregarAccesoOffline({
      socioId: 10,
      codigoTotp: '123456',
      tipo: 'ingreso',
    })

    expect(cola.value).toHaveLength(1)
    expect(cola.value[0]!.socioId).toBe(10)
    expect(cola.value[0]!.codigoTotp).toBe('123456')
    expect(cola.value[0]!.tipo).toBe('ingreso')

    const persistido = JSON.parse(localStorage.getItem('fitzone_accesos_offline') || '[]')
    expect(persistido).toHaveLength(1)
    expect(persistido[0]!.socioId).toBe(10)
  })

  it('reconcilia la cola eliminando solo los items con ok: true y reteniendo los rechazados', async () => {
    const sedeId = ref(1)
    const { cola, agregarAccesoOffline, sincronizar } = useSincronizacionOffline(sedeId)

    agregarAccesoOffline({ socioId: 1, codigoTotp: '111111', tipo: 'ingreso' })
    agregarAccesoOffline({ socioId: 2, codigoTotp: '222222', tipo: 'ingreso' })

    const id1 = cola.value[0]!.localId
    const id2 = cola.value[1]!.localId

    mockSincronizarIngresos.mockResolvedValueOnce({
      resultados: [
        { localId: id1, ok: true, serverId: 100 },
        { localId: id2, ok: false, error: 'USUARIO_BLOQUEADO', detalle: 'Membresía VENCIDA' },
      ],
      egresosProcesados: [],
    })

    await sincronizar()

    expect(mockSincronizarIngresos).toHaveBeenCalledTimes(1)
    // El id1 fue aceptado y eliminado; el id2 fue rechazado y retenido
    expect(cola.value).toHaveLength(1)
    expect(cola.value[0]!.localId).toBe(id2)
  })

  it('con la cola vacía no llama a la API', async () => {
    const { sincronizar } = useSincronizacionOffline(ref(1))

    await sincronizar()

    expect(mockSincronizarIngresos).not.toHaveBeenCalled()
  })

  it('al recargar la pantalla recupera la cola guardada en localStorage', () => {
    useSincronizacionOffline(ref(1)).agregarAccesoOffline({ socioId: 5, codigoTotp: '555555', tipo: 'ingreso' })

    const { cola } = useSincronizacionOffline(ref(1))

    expect(cola.value.map((c) => c.socioId)).toEqual([5])
  })

  it('una cola guardada corrupta arranca vacía', () => {
    localStorage.setItem('fitzone_accesos_offline', '{roto')

    expect(useSincronizacionOffline(ref(1)).cola.value).toEqual([])
  })

  it('manda ingresos y egresos por separado y saca de la cola los egresos aceptados', async () => {
    const { cola, agregarAccesoOffline, sincronizar } = useSincronizacionOffline(ref(1))
    agregarAccesoOffline({ socioId: 1, codigoTotp: '111111', tipo: 'ingreso' })
    agregarAccesoOffline({ socioId: 1, codigoTotp: '', tipo: 'egreso', ingresoLocalId: 77 })
    const [ingreso, egreso] = cola.value
    mockSincronizarIngresos.mockResolvedValueOnce({
      resultados: [{ localId: ingreso!.localId, ok: true, serverId: 100 }],
      egresosProcesados: [{ localId: egreso!.localId, ok: true }],
    })

    await sincronizar()

    const payload = mockSincronizarIngresos.mock.calls[0]![0]
    expect(payload.ingresos).toEqual([
      { localId: ingreso!.localId, socioId: 1, codigoTotp: '111111', fechaHoraIngreso: ingreso!.fechaHoraIngreso },
    ])
    expect(payload.egresos).toEqual([
      { localId: egreso!.localId, ingresoLocalId: 77, fechaHoraEgreso: egreso!.fechaHoraIngreso },
    ])
    expect(cola.value).toEqual([])
    expect(JSON.parse(localStorage.getItem('fitzone_accesos_offline')!)).toEqual([])
  })

  it('sin egresos no manda el campo egresos', async () => {
    const { agregarAccesoOffline, sincronizar } = useSincronizacionOffline(ref(1))
    agregarAccesoOffline({ socioId: 1, codigoTotp: '111111', tipo: 'ingreso' })
    mockSincronizarIngresos.mockResolvedValueOnce({ resultados: [], egresosProcesados: [] })

    await sincronizar()

    expect(mockSincronizarIngresos.mock.calls[0]![0].egresos).toBeUndefined()
  })

  it('si la sincronización falla, la cola queda entera y se informa el error', async () => {
    const { cola, error, sincronizando, agregarAccesoOffline, sincronizar } = useSincronizacionOffline(ref(1))
    agregarAccesoOffline({ socioId: 1, codigoTotp: '111111', tipo: 'ingreso' })
    mockSincronizarIngresos.mockRejectedValueOnce(new Error('sin red'))

    await sincronizar()

    expect(cola.value).toHaveLength(1)
    expect(error.value).toBe('No se pudo sincronizar el lote offline.')
    expect(sincronizando.value).toBe(false)
  })

  it('limpiarCola vacía la cola y lo guardado', () => {
    const { cola, agregarAccesoOffline, limpiarCola } = useSincronizacionOffline(ref(1))
    agregarAccesoOffline({ socioId: 1, codigoTotp: '111111', tipo: 'ingreso' })

    limpiarCola()

    expect(cola.value).toEqual([])
    expect(localStorage.getItem('fitzone_accesos_offline')).toBe('[]')
  })
})
