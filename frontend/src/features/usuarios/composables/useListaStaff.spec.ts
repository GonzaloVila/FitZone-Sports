import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'

const mocks = vi.hoisted(() => ({ listar: vi.fn() }))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ usuarios: mocks }),
}))

import type { Usuario } from '../services/servicioUsuarios'
import { useListaStaff } from './useListaStaff'

const usuario = (id: number): Usuario => ({
  id,
  rol: 'RECEPCION',
  dni: `${35000000 + id}`,
  nombre: `Persona ${id}`,
  email: `persona${id}@fitzone.com.ar`,
})

async function vaciar() {
  for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(0)
}

let scope: EffectScope

async function armar() {
  scope = effectScope()
  const lista = scope.run(() => useListaStaff())!
  await vaciar()
  return lista
}

describe('useListaStaff', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.listar.mockReset().mockResolvedValue({ items: [usuario(1), usuario(2)], total: 2 })
  })

  afterEach(() => {
    scope?.stop()
    vi.useRealTimers()
  })

  it('carga la primera página de recepcionistas', async () => {
    const lista = await armar()

    expect(lista.porPagina).toBe(10)
    expect(mocks.listar).toHaveBeenCalledWith(
      { rol: 'RECEPCION' },
      1,
      10,
      expect.any(AbortSignal),
    )
    expect(lista.items.value.map((item) => item.id)).toEqual([1, 2])
    expect(lista.total.value).toBe(2)
    expect(lista.cargando.value).toBe(false)
  })

  it('la búsqueda espera 300 ms, recorta el nombre y vuelve a la página 1', async () => {
    mocks.listar.mockResolvedValue({ items: [usuario(1)], total: 25 })
    const lista = await armar()
    lista.pagina.value = 2
    await vaciar()
    mocks.listar.mockClear()

    lista.nombre.value = '  Ana  '
    await vi.advanceTimersByTimeAsync(299)
    expect(mocks.listar).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await vaciar()

    expect(lista.pagina.value).toBe(1)
    expect(mocks.listar).toHaveBeenLastCalledWith(
      { rol: 'RECEPCION', nombre: 'Ana' },
      1,
      10,
      expect.any(AbortSignal),
    )
  })

  it('pasar de página consulta esa página', async () => {
    mocks.listar.mockResolvedValue({ items: [usuario(1)], total: 25 })
    const lista = await armar()
    mocks.listar.mockClear()

    lista.pagina.value = 2
    await vaciar()

    expect(mocks.listar).toHaveBeenCalledWith({ rol: 'RECEPCION' }, 2, 10, expect.any(AbortSignal))
  })

  it('si la página quedó fuera de rango vuelve a la última válida', async () => {
    mocks.listar.mockImplementation((_filtros, pagina: number) =>
      pagina === 99
        ? Promise.resolve({ items: [], total: 25 })
        : Promise.resolve({ items: [usuario(pagina)], total: 25 }),
    )
    const lista = await armar()

    lista.pagina.value = 99
    await vaciar()

    expect(lista.pagina.value).toBe(3)
    expect(lista.items.value.map((item) => item.id)).toEqual([3])
  })

  it('muestra el error del listado y vacía las filas', async () => {
    mocks.listar.mockRejectedValue(new Error('boom'))
    const lista = await armar()

    expect(lista.error.value).toBe('No se pudo cargar el listado de recepcionistas.')
    expect(lista.items.value).toEqual([])
    expect(lista.total.value).toBe(0)
  })

  it('recargar vuelve a pedir la página actual', async () => {
    const lista = await armar()
    mocks.listar.mockClear()

    await lista.recargar()

    expect(mocks.listar).toHaveBeenCalledTimes(1)
  })
})
