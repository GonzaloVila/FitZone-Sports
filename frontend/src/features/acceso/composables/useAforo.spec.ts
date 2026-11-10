import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref, type Ref } from 'vue'
import { ServiciosKey, type Servicios } from '@/compartido/servicios'
import { useAforo } from './useAforo'

// RF-05: el aforo de la sede activa, refrescado cada 10 segundos.
const aforoDe = (sedeId: number, actual: number, maximo = 100) => ({ sedeId, aforoActual: actual, aforoMaximo: maximo })

function montar(sedeId: Ref<number | null>, obtenerAforo = vi.fn(async (id: number, _senal?: AbortSignal) => aforoDe(id, 40))) {
  let api!: ReturnType<typeof useAforo>
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useAforo(sedeId)
        return {}
      },
      template: '<div />',
    }),
    { global: { provide: { [ServiciosKey as symbol]: { acceso: { obtenerAforo } } as unknown as Servicios } } },
  )
  return { api, obtenerAforo, wrapper }
}

describe('useAforo', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('consulta el aforo de la sede al montar', async () => {
    const { api, obtenerAforo } = montar(ref(3))
    await flushPromises()

    expect(obtenerAforo).toHaveBeenCalledWith(3, expect.any(AbortSignal))
    expect(api.aforo.value).toEqual(aforoDe(3, 40))
    expect(api.cargando.value).toBe(false)
    expect(api.estaLleno.value).toBe(false)
  })

  it('sin sede no consulta nada', async () => {
    const { api, obtenerAforo } = montar(ref(null))
    await flushPromises()

    expect(obtenerAforo).not.toHaveBeenCalled()
    expect(api.aforo.value).toBeNull()
  })

  it('se refresca solo cada 10 segundos', async () => {
    const { obtenerAforo, wrapper } = montar(ref(3))
    await flushPromises()

    await vi.advanceTimersByTimeAsync(10_000)
    expect(obtenerAforo).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('al cambiar de sede limpia el dato anterior, cancela la consulta en vuelo y pide la nueva', async () => {
    const sede = ref<number | null>(3)
    const { api, obtenerAforo } = montar(sede)
    await flushPromises()

    sede.value = 5
    await flushPromises()

    const senalAnterior = obtenerAforo.mock.calls[0]![1]!
    expect(senalAnterior.aborted).toBe(true)
    expect(obtenerAforo).toHaveBeenLastCalledWith(5, expect.any(AbortSignal))
    expect(api.aforo.value).toEqual(aforoDe(5, 40))
  })

  it('marca la sede como llena cuando llegó al máximo', async () => {
    const { api } = montar(ref(3), vi.fn(async () => aforoDe(3, 100)))
    await flushPromises()

    expect(api.estaLleno.value).toBe(true)
  })

  it('un error se muestra y no borra el último aforo conocido', async () => {
    const obtenerAforo = vi.fn().mockResolvedValueOnce(aforoDe(3, 40)).mockRejectedValueOnce(new Error('caído'))
    const { api } = montar(ref(3), obtenerAforo)
    await flushPromises()

    await api.refrescar()

    expect(api.error.value).toBe('No se pudo obtener el aforo de la sede.')
    expect(api.aforo.value).toEqual(aforoDe(3, 40))
  })

  it('pausar detiene el refresco automático', async () => {
    const { api, obtenerAforo } = montar(ref(3))
    await flushPromises()

    api.pausar()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(obtenerAforo).toHaveBeenCalledTimes(1)
  })
})
