import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { ServiciosKey, type Servicios } from '@/compartido/servicios'
import { CLAVE_BLOQUEADOS, useListaBloqueadosOffline } from './useListaBloqueadosOffline'

// RNF-01: la lista local de socios inhabilitados del puesto de control. El servicio de acceso es un doble; el composable
// se monta dentro de un componente porque se engancha a onMounted y al evento `online`.
const RESPUESTA_COMPLETA = {
  bloqueados: [
    { socioId: 12, motivo: 'VENCIDA' as const, desde: '2026-11-01T03:00:00Z' },
    { socioId: 15, motivo: 'SUSPENDIDA' as const, desde: '2026-11-05T03:00:00Z' },
  ],
  total: 2,
  servidorTime: '2026-11-09T12:00:00Z',
}

function montar(opciones: { enLinea?: boolean } = {}) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(opciones.enLinea ?? true)
  const listarBloqueados = vi.fn().mockResolvedValue(RESPUESTA_COMPLETA)
  let api!: ReturnType<typeof useListaBloqueadosOffline>
  const Prueba = defineComponent({
    setup() {
      api = useListaBloqueadosOffline()
      return {}
    },
    template: '<div />',
  })
  const wrapper = mount(Prueba, {
    global: { provide: { [ServiciosKey as symbol]: { acceso: { listarBloqueados } } as unknown as Servicios } },
  })
  return { api, listarBloqueados, wrapper }
}

const guardado = () => JSON.parse(localStorage.getItem(CLAVE_BLOQUEADOS) ?? 'null')

describe('useListaBloqueadosOffline', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('al abrir la pantalla con conexión descarga la lista completa y la guarda en localStorage', async () => {
    const { api, listarBloqueados } = montar()
    await vi.waitFor(() => expect(api.lista.value.ultimaSincronizacion).not.toBeNull())

    expect(listarBloqueados).toHaveBeenCalledWith(undefined)
    expect(guardado()).toEqual({
      bloqueados: {
        12: { motivo: 'VENCIDA', desde: '2026-11-01T03:00:00Z' },
        15: { motivo: 'SUSPENDIDA', desde: '2026-11-05T03:00:00Z' },
      },
      // La hora del servidor, no la del puesto.
      ultimaSincronizacion: '2026-11-09T12:00:00Z',
    })
  })

  it('estaBloqueado y bloqueoDe responden con la lista local', async () => {
    const { api } = montar()
    await vi.waitFor(() => expect(api.estaBloqueado(12)).toBe(true))

    expect(api.bloqueoDe(15)).toEqual({ motivo: 'SUSPENDIDA', desde: '2026-11-05T03:00:00Z' })
    expect(api.estaBloqueado(99)).toBe(false)
    expect(api.bloqueoDe(99)).toBeNull()
  })

  it('sin conexión no pide nada y usa la lista que quedó guardada', () => {
    localStorage.setItem(
      CLAVE_BLOQUEADOS,
      JSON.stringify({ bloqueados: { 7: { motivo: 'VENCIDA', desde: '2026-10-01T00:00:00Z' } }, ultimaSincronizacion: '2026-11-08T10:00:00Z' }),
    )

    const { api, listarBloqueados } = montar({ enLinea: false })

    expect(listarBloqueados).not.toHaveBeenCalled()
    expect(api.estaBloqueado(7)).toBe(true)
  })

  it('al volver la conexión hace una sincronización incremental desde la última y suma los cambios', async () => {
    const { api, listarBloqueados } = montar()
    await vi.waitFor(() => expect(api.lista.value.ultimaSincronizacion).toBe('2026-11-09T12:00:00Z'))
    listarBloqueados.mockResolvedValueOnce({
      bloqueados: [{ socioId: 20, motivo: 'VENCIDA', desde: '2026-11-09T13:00:00Z' }],
      total: 1,
      servidorTime: '2026-11-09T14:00:00Z',
    })

    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(api.lista.value.ultimaSincronizacion).toBe('2026-11-09T14:00:00Z'))

    expect(listarBloqueados).toHaveBeenLastCalledWith('2026-11-09T12:00:00Z')
    expect([12, 15, 20].map(api.estaBloqueado)).toEqual([true, true, true])
  })

  it('la sincronización completa reemplaza la lista: saca a quien volvió a estar vigente', async () => {
    localStorage.setItem(
      CLAVE_BLOQUEADOS,
      JSON.stringify({ bloqueados: { 3: { motivo: 'VENCIDA', desde: '2026-10-01T00:00:00Z' } }, ultimaSincronizacion: '2026-11-01T00:00:00Z' }),
    )

    const { api } = montar()
    await vi.waitFor(() => expect(api.lista.value.ultimaSincronizacion).toBe('2026-11-09T12:00:00Z'))

    expect(api.estaBloqueado(3)).toBe(false)
    expect(api.estaBloqueado(12)).toBe(true)
  })

  it('si la sincronización falla, conserva la lista anterior y deja el error', async () => {
    const { api, listarBloqueados } = montar()
    await vi.waitFor(() => expect(api.estaBloqueado(12)).toBe(true))
    listarBloqueados.mockRejectedValueOnce(new Error('sin red'))

    await api.sincronizar()

    expect(api.estaBloqueado(12)).toBe(true)
    expect(api.error.value).toBe('No se pudo actualizar la lista de socios inhabilitados.')
    expect(api.sincronizando.value).toBe(false)
  })

  it('dos pedidos simultáneos comparten una sola petición', async () => {
    const { api, listarBloqueados } = montar({ enLinea: false })

    await Promise.all([api.sincronizar(), api.sincronizar()])

    expect(listarBloqueados).toHaveBeenCalledTimes(1)
  })

  it('una lista guardada corrupta arranca vacía', () => {
    localStorage.setItem(CLAVE_BLOQUEADOS, '{no es json')

    const { api } = montar({ enLinea: false })

    expect(api.lista.value).toEqual({ bloqueados: {}, ultimaSincronizacion: null })
  })

  it('al desmontar deja de escuchar el evento online', async () => {
    const { listarBloqueados, wrapper } = montar({ enLinea: false })

    wrapper.unmount()
    window.dispatchEvent(new Event('online'))

    expect(listarBloqueados).not.toHaveBeenCalled()
  })
})
