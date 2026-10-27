import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, type EffectScope } from 'vue'

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  route: { name: 'personal', query: {} as Record<string, unknown> },
  replace: vi.fn(),
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ usuarios: { listar: mocks.listar } }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace }),
}))

import type { Usuario } from '../services/servicioUsuarios'
import { useListaPersonal } from './useListaPersonal'

const usuario = (id: number): Usuario => ({
  id,
  rol: 'RECEPCION',
  dni: `${35000000 + id}`,
  nombre: `Persona ${id}`,
  email: `persona${id}@fitzone.com.ar`,
})

const ultimoReplace = () => mocks.replace.mock.calls.at(-1)?.[0]

let scope: EffectScope

function armar() {
  scope = effectScope()
  return scope.run(() => useListaPersonal())!
}

describe('useListaPersonal', () => {
  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue({ items: [usuario(1), usuario(2)], total: 2 })
    mocks.route = reactive({ name: 'personal', query: {} as Record<string, unknown> })
    // El router de verdad deja la dirección nueva en la ruta: acá se imita.
    mocks.replace.mockReset().mockImplementation(async ({ query }: { query: Record<string, unknown> }) => {
      mocks.route.query = query
    })
  })

  afterEach(() => {
    scope?.stop()
    vi.useRealTimers()
  })

  it('carga la primera página de recepcionistas', async () => {
    const lista = armar()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    expect(lista.porPagina).toBe(10)
    expect(mocks.listar).toHaveBeenCalledWith({ rol: 'RECEPCION' }, 1, 10, expect.any(AbortSignal))
    await vi.waitFor(() => expect(lista.cargando.value).toBe(false))
    expect(lista.items.value.map((item) => item.id)).toEqual([1, 2])
    expect(lista.total.value).toBe(2)
  })

  it('arranca con lo que dice la dirección y descarta lo inválido', async () => {
    mocks.route.query = { nombre: ' Ana ', pagina: '2' }
    const lista = armar()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    expect(lista.nombre.value).toBe('Ana')
    expect(lista.pagina.value).toBe(2)
    expect(mocks.listar).toHaveBeenCalledWith({ rol: 'RECEPCION', nombre: 'Ana' }, 2, 10, expect.any(AbortSignal))

    scope.stop()
    mocks.listar.mockClear()
    mocks.route.query = { pagina: '-4' }
    const otra = armar()
    expect(otra.pagina.value).toBe(1)
  })

  it('la búsqueda se escribe en la dirección a los 300 ms, recortada y volviendo a la página 1', async () => {
    mocks.route.query = { pagina: '2' }
    mocks.listar.mockResolvedValue({ items: [usuario(1)], total: 25 })
    const lista = armar()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))
    vi.useFakeTimers()

    lista.nombre.value = 'A'
    await nextTick()
    lista.nombre.value = '  Ana  '
    await nextTick()
    vi.advanceTimersByTime(299)
    expect(mocks.replace).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)

    expect(mocks.replace).toHaveBeenCalledTimes(1)
    expect(ultimoReplace()).toEqual({ query: { nombre: 'Ana' } })
    vi.useRealTimers()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))
    expect(mocks.listar).toHaveBeenLastCalledWith({ rol: 'RECEPCION', nombre: 'Ana' }, 1, 10, expect.any(AbortSignal))
  })

  it('pasar de página reemplaza la dirección y consulta esa página', async () => {
    mocks.listar.mockResolvedValue({ items: [usuario(1)], total: 25 })
    const lista = armar()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    lista.pagina.value = 2

    expect(ultimoReplace()).toEqual({ query: { pagina: '2' } })
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))
    expect(mocks.listar).toHaveBeenLastCalledWith({ rol: 'RECEPCION' }, 2, 10, expect.any(AbortSignal))
  })

  it('si la dirección cambia por otro lado (Atrás, un enlace) el campo y la consulta la siguen', async () => {
    mocks.route.query = { nombre: 'Ana' }
    const lista = armar()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    mocks.route.query = { nombre: 'Luz' }
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))

    expect(lista.nombre.value).toBe('Luz')
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('al salir hacia otra ruta no reacciona a los parámetros de esa ruta', async () => {
    mocks.route.query = { nombre: 'Ana' }
    const lista = armar()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    mocks.route.name = 'otra'
    mocks.route.query = { nombre: 'Otro' }
    await nextTick()

    expect(lista.nombre.value).toBe('Ana')
    expect(mocks.listar).toHaveBeenCalledTimes(1)
  })

  it('una página fuera de rango vuelve a la última válida', async () => {
    mocks.route.query = { pagina: '9' }
    mocks.listar.mockImplementation((_filtros, pagina: number) =>
      Promise.resolve({ items: pagina === 9 ? [] : [usuario(pagina)], total: 25 }),
    )
    const lista = armar()

    await vi.waitFor(() => expect(lista.pagina.value).toBe(3))

    expect(ultimoReplace()).toEqual({ query: { pagina: '3' } })
    await vi.waitFor(() => expect(lista.items.value.map((item) => item.id)).toEqual([3]))
  })

  it('limpiar los filtros vacía el campo y quita el nombre de la dirección', async () => {
    mocks.route.query = { nombre: 'Ana', pagina: '2' }
    const lista = armar()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))
    expect(lista.hayFiltrosActivos.value).toBe(true)

    lista.limpiarFiltros()

    expect(lista.nombre.value).toBe('')
    expect(ultimoReplace()).toEqual({ query: {} })
    expect(lista.hayFiltrosActivos.value).toBe(false)
  })

  it('muestra el error del listado y vacía las filas', async () => {
    mocks.listar.mockRejectedValue(new Error('boom'))
    const lista = armar()

    await vi.waitFor(() => expect(lista.error.value).toBe('No se pudo cargar el listado de recepcionistas.'))

    expect(lista.items.value).toEqual([])
    expect(lista.total.value).toBe(0)
  })

  it('recargar vuelve a pedir la página actual', async () => {
    const lista = armar()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    await lista.recargar()

    expect(mocks.listar).toHaveBeenCalledTimes(2)
  })
})
