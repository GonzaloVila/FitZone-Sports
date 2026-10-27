import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive } from 'vue'

// hayFiltrosActivos y limpiarFiltros de useCanchas.
const mocks = vi.hoisted(() => ({
  buscar: vi.fn(),
  sedeId: { value: null as number | null },
  route: { name: 'canchas', query: {} as Record<string, unknown> },
  replace: vi.fn(),
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ canchas: { buscar: mocks.buscar } }),
}))

vi.mock('@/features/sesion/composables/useUsuarioSesion', () => ({
  useUsuarioSesion: () => ({ sedeId: mocks.sedeId }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace }),
}))

import { useCanchas } from './useCanchas'

function armar(sedePorDefecto?: Parameters<typeof useCanchas>[0]) {
  const scope = effectScope()
  const estado = scope.run(() => useCanchas(sedePorDefecto))!
  return { ...estado, detener: () => scope.stop() }
}

const ultimoReplace = () => mocks.replace.mock.calls.at(-1)?.[0]
const sinFiltros = { sedeId: undefined, tipo: undefined, estado: undefined }

describe('useCanchas: hayFiltrosActivos y limpiarFiltros', () => {
  beforeEach(() => {
    mocks.buscar.mockReset().mockResolvedValue({ items: [], total: 0 })
    mocks.sedeId.value = null
    mocks.route = reactive({ name: 'canchas', query: {} as Record<string, unknown> })
    // El router de verdad deja la dirección nueva en la ruta: acá se imita.
    mocks.replace.mockReset().mockImplementation(async ({ query }: { query: Record<string, unknown> }) => {
      mocks.route.query = query
    })
  })

  it('sin nada elegido no hay filtros activos', () => {
    const { hayFiltrosActivos, detener } = armar()

    expect(hayFiltrosActivos.value).toBe(false)
    detener()
  })

  it('un deporte, un estado o una sede concreta cuentan como filtro activo', () => {
    for (const query of [{ tipo: 'PADDLE' }, { estado: 'OPERATIVA' }, { sede: '3' }]) {
      mocks.route.query = query
      const { hayFiltrosActivos, detener } = armar()
      expect(hayFiltrosActivos.value, JSON.stringify(query)).toBe(true)
      detener()
    }
  })

  it('"Todas las sedes" elegida a propósito, la sede por defecto y la fija del RECEPCION no cuentan', () => {
    mocks.route.query = { sede: 'todas' }
    const todas = armar()
    expect(todas.hayFiltrosActivos.value).toBe(false)
    todas.detener()

    mocks.route.query = {}
    const porDefecto = armar(() => 4)
    expect(porDefecto.hayFiltrosActivos.value).toBe(false)
    porDefecto.detener()

    mocks.sedeId.value = 2
    mocks.route.query = { sede: '9' }
    const fija = armar()
    expect(fija.hayFiltrosActivos.value).toBe(false)
    fija.detener()
  })

  it('un tipo desconocido en la dirección no cuenta como filtro', () => {
    mocks.route.query = { tipo: 'TENIS' }
    const { hayFiltrosActivos, detener } = armar()

    expect(hayFiltrosActivos.value).toBe(false)
    detener()
  })

  it('limpiar quita deporte, estado y sede de la dirección, vuelve a la página 1 y conserva la vista', async () => {
    mocks.route.query = { vista: 'canchas', sede: '3', tipo: 'PADDLE', estado: 'OPERATIVA', pagina: '2' }
    mocks.buscar.mockResolvedValue({ items: [], total: 60 })
    const { limpiarFiltros, hayFiltrosActivos, detener } = armar()
    await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))
    expect(hayFiltrosActivos.value).toBe(true)

    limpiarFiltros()

    expect(ultimoReplace()).toEqual({ query: { vista: 'canchas' } })
    await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(2))
    expect(mocks.buscar).toHaveBeenLastCalledWith(sinFiltros, 1, 12, expect.anything())
    expect(hayFiltrosActivos.value).toBe(false)
    detener()
  })
})
