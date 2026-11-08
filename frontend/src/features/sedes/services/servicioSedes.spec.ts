import createClient from 'openapi-fetch'
import { describe, expect, it, vi } from 'vitest'
import type { paths } from '@/types/api'
import { crearServicioSedes } from './servicioSedes'

// El contrato pagina las sedes (perPage máximo 100): `listar` pide páginas hasta traerlas todas.
const sede = (id: number) => ({ id, nombre: `Sede ${id}` })

function armar(paginas: { items: unknown[]; total: number }[]) {
  const fetchFalso = vi.fn(async (peticion: Request) => {
    const pagina = Number(new URL(peticion.url).searchParams.get('page') ?? 1)
    return Response.json(paginas[pagina - 1] ?? { items: [], total: 0 })
  })
  const cliente = createClient<paths>({ baseUrl: 'http://api.test/api/v1', fetch: fetchFalso })
  return { servicio: crearServicioSedes(cliente), fetchFalso }
}

const paginasPedidas = (fetchFalso: ReturnType<typeof armar>['fetchFalso']) =>
  fetchFalso.mock.calls.map(([p]) => new URL(p.url).searchParams.get('page'))

describe('servicioSedes.listar', () => {
  it('con una sola página hace una sola petición, de a 100', async () => {
    const { servicio, fetchFalso } = armar([{ items: [sede(1), sede(2)], total: 2 }])

    expect(await servicio.listar()).toEqual([sede(1), sede(2)])
    expect(fetchFalso).toHaveBeenCalledTimes(1)
    expect(new URL(fetchFalso.mock.calls[0]![0].url).searchParams.get('perPage')).toBe('100')
  })

  it('junta las páginas hasta llegar al total', async () => {
    const { servicio, fetchFalso } = armar([
      { items: [sede(1), sede(2)], total: 5 },
      { items: [sede(3), sede(4)], total: 5 },
      { items: [sede(5)], total: 5 },
    ])

    expect((await servicio.listar()).map((s) => (s as { id: number }).id)).toEqual([1, 2, 3, 4, 5])
    expect(paginasPedidas(fetchFalso)).toEqual(['1', '2', '3'])
  })

  it('corta si una página llega vacía aunque el total diga que faltan', async () => {
    const { servicio, fetchFalso } = armar([{ items: [sede(1)], total: 10 }, { items: [], total: 10 }])

    expect(await servicio.listar()).toHaveLength(1)
    expect(fetchFalso).toHaveBeenCalledTimes(2)
  })

  it('con un total inconsistente no queda en bucle: corta a las 50 páginas', async () => {
    const fetchFalso = vi.fn(async () => Response.json({ items: [sede(1)], total: 1_000_000 }))
    const cliente = createClient<paths>({ baseUrl: 'http://api.test/api/v1', fetch: fetchFalso })

    await crearServicioSedes(cliente).listar()

    expect(fetchFalso).toHaveBeenCalledTimes(50)
  })
})

describe('servicioSedes.crear', () => {
  it('manda POST /sedes con los datos de la sede', async () => {
    const { servicio, fetchFalso } = armar([])
    const nueva = { nombre: 'Sede Norte', direccion: 'Av. Siempreviva 742', capacidadMaxima: 80 }

    await servicio.crear(nueva as never)

    const peticion = fetchFalso.mock.calls.at(-1)![0]
    expect(peticion.method).toBe('POST')
    expect(new URL(peticion.url).pathname).toBe('/api/v1/sedes')
    expect(await peticion.json()).toEqual(nueva)
  })
})
