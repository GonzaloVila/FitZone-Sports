import createClient from 'openapi-fetch'
import { describe, expect, it, vi } from 'vitest'
import type { paths } from '@/types/api'
import { crearServicioCanchas } from './servicioCanchas'

// El servicio real con el cliente real de openapi-fetch, pero con un `fetch` falso: se mira la URL que sale.
function armar() {
  const fetchFalso = vi.fn(async (_peticion: Request) => Response.json({ items: [], total: 0 }))
  const cliente = createClient<paths>({ baseUrl: 'http://api.test/api/v1', fetch: fetchFalso })
  return { servicio: crearServicioCanchas(cliente), fetchFalso }
}

const urlDe = (fetchFalso: ReturnType<typeof armar>['fetchFalso']) => {
  const peticion = fetchFalso.mock.calls.at(-1)?.[0]
  if (!peticion) throw new Error('No se hizo ninguna petición')
  return new URL(peticion.url)
}

describe('servicioCanchas.buscar', () => {
  it('pide GET /canchas', async () => {
    const { servicio, fetchFalso } = armar()

    await servicio.buscar({}, 1, 12)

    expect(urlDe(fetchFalso).pathname).toBe('/api/v1/canchas')
    expect(fetchFalso.mock.calls.at(-1)?.[0].method).toBe('GET')
  })

  it('el tipo viaja como un único ?tipo=', async () => {
    const { servicio, fetchFalso } = armar()

    await servicio.buscar({ tipo: 'PADDLE' }, 1, 12)

    expect(urlDe(fetchFalso).searchParams.getAll('tipo')).toEqual(['PADDLE'])
  })

  it('sin tipo no manda el parámetro', async () => {
    const { servicio, fetchFalso } = armar()

    await servicio.buscar({}, 1, 12)
    expect(urlDe(fetchFalso).searchParams.has('tipo')).toBe(false)

    await servicio.buscar({ tipo: undefined }, 1, 12)
    expect(urlDe(fetchFalso).searchParams.has('tipo')).toBe(false)
  })

  it('combina tipo con sede, estado y paginación', async () => {
    const { servicio, fetchFalso } = armar()

    await servicio.buscar({ sedeId: 3, tipo: 'FUTBOL5', estado: 'OPERATIVA' }, 2, 12)

    const url = urlDe(fetchFalso)
    expect(url.searchParams.get('sedeId')).toBe('3')
    expect(url.searchParams.get('tipo')).toBe('FUTBOL5')
    expect(url.searchParams.get('estado')).toBe('OPERATIVA')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('perPage')).toBe('12')
  })

  it('devuelve la lista del servidor tal cual', async () => {
    const { servicio } = armar()

    await expect(servicio.buscar({}, 1, 12)).resolves.toEqual({ items: [], total: 0 })
  })
})
