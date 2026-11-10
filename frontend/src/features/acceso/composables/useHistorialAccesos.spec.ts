import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { ServiciosKey, type Servicios } from '@/compartido/servicios'
import { useHistorialAccesos } from './useHistorialAccesos'

// RF-05: historial de accesos con filtros, búsqueda por nombre con espera y paginación de a 10.
function montar(sedeInicial?: number | null) {
  const listarIngresos = vi.fn().mockResolvedValue({ items: [{ id: 1 }], total: 25 })
  let api!: ReturnType<typeof useHistorialAccesos>
  mount(
    defineComponent({
      setup() {
        api = useHistorialAccesos(sedeInicial)
        return {}
      },
      template: '<div />',
    }),
    { global: { provide: { [ServiciosKey as symbol]: { acceso: { listarIngresos } } as unknown as Servicios } } },
  )
  return { api, listarIngresos }
}

const ultimosFiltros = (listarIngresos: ReturnType<typeof montar>['listarIngresos']) => listarIngresos.mock.lastCall![0]

describe('useHistorialAccesos', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('carga la primera página al montar, con la sede inicial del RECEPCION', async () => {
    const { api, listarIngresos } = montar(3)
    await flushPromises()

    expect(ultimosFiltros(listarIngresos)).toEqual({
      sedeId: 3,
      socioId: undefined,
      nombre: undefined,
      fecha: undefined,
      page: 1,
      perPage: 10,
    })
    expect(api.total.value).toBe(25)
    expect(api.totalPaginas.value).toBe(3)
  })

  it('el GERENTE (sin sede inicial) ve todas las sedes', async () => {
    const { listarIngresos } = montar(null)
    await flushPromises()

    expect(ultimosFiltros(listarIngresos).sedeId).toBeUndefined()
  })

  it('cambiar un filtro vuelve a la página 1 y recarga', async () => {
    const { api, listarIngresos } = montar(3)
    await flushPromises()
    api.pagina.value = 2
    await flushPromises()
    expect(ultimosFiltros(listarIngresos).page).toBe(2)

    api.filtros.fecha = '2026-11-10'
    api.filtros.socioId = 12
    await flushPromises()

    expect(api.pagina.value).toBe(1)
    expect(ultimosFiltros(listarIngresos)).toMatchObject({ fecha: '2026-11-10', socioId: 12, page: 1 })
  })

  it('el nombre se aplica 300 ms después de dejar de escribir, ya recortado', async () => {
    const { api, listarIngresos } = montar(3)
    await flushPromises()
    const llamadasIniciales = listarIngresos.mock.calls.length

    api.filtros.nombre = 'an'
    await flushPromises()
    api.filtros.nombre = ' ana '
    await vi.advanceTimersByTimeAsync(299)
    expect(listarIngresos.mock.calls.length).toBe(llamadasIniciales)

    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(listarIngresos.mock.calls.length).toBe(llamadasIniciales + 1)
    expect(ultimosFiltros(listarIngresos).nombre).toBe('ana')
  })

  it('un error vacía la lista y deja el mensaje', async () => {
    const { api, listarIngresos } = montar(3)
    await flushPromises()
    listarIngresos.mockRejectedValue(new Error('caído'))

    await api.recargar()

    expect(api.error.value).toBe('No se pudo cargar el historial de accesos.')
    expect(api.items.value).toEqual([])
    expect(api.total.value).toBe(0)
    expect(api.totalPaginas.value).toBe(1)
  })

  it('si llegan dos respuestas, se queda con la de la última consulta', async () => {
    const { api, listarIngresos } = montar(3)
    await flushPromises()
    let resolverVieja!: (v: unknown) => void
    listarIngresos
      .mockImplementationOnce(() => new Promise((r) => (resolverVieja = r)))
      .mockResolvedValueOnce({ items: [{ id: 99 }], total: 1 })

    const vieja = api.recargar()
    await api.recargar()
    resolverVieja({ items: [{ id: 1 }], total: 25 })
    await vieja

    expect(api.items.value).toEqual([{ id: 99 }])
    expect(api.cargando.value).toBe(false)
  })
})
