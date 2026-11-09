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
})
