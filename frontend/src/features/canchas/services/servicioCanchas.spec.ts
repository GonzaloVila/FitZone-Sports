import createClient from 'openapi-fetch'
import { describe, expect, it, vi } from 'vitest'
import type { paths } from '@/types/api'
import { crearServicioCanchas, type ServicioCanchas } from './servicioCanchas'

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

// RF-09 a RF-12: el resto de las operaciones de canchas y de sus reservas, con el método, la ruta y el cuerpo que salen.
const casos: [string, (s: ServicioCanchas) => Promise<unknown>, string, string, unknown][] = [
  ['obtener', (s) => s.obtener(4), 'GET', '/api/v1/canchas/4', undefined],
  ['crear', (s) => s.crear(2, { tipo: 'PADDLE' } as never), 'POST', '/api/v1/sedes/2/canchas', { tipo: 'PADDLE' }],
  ['modificar', (s) => s.modificar(4, { estado: 'MANTENIMIENTO' } as never), 'PATCH', '/api/v1/canchas/4', { estado: 'MANTENIMIENTO' }],
  ['consultarDisponibilidad', (s) => s.consultarDisponibilidad(4, '2026-11-10'), 'GET', '/api/v1/canchas/4/disponibilidad', undefined],
  ['crearReserva', (s) => s.crearReserva({ canchaId: 4 } as never), 'POST', '/api/v1/reservas-canchas', { canchaId: 4 }],
  ['listarReservas', (s) => s.listarReservas({}, 1, 10), 'GET', '/api/v1/reservas-canchas', undefined],
  ['obtenerReserva', (s) => s.obtenerReserva(15), 'GET', '/api/v1/reservas-canchas/15', undefined],
  ['cancelarReserva', (s) => s.cancelarReserva(15), 'POST', '/api/v1/reservas-canchas/15/cancelaciones', undefined],
]

describe('servicioCanchas (resto de las operaciones)', () => {
  it.each(casos)('%s pide %s %s', async (_nombre, llamar, metodo, ruta, cuerpo) => {
    const { servicio, fetchFalso } = armar()

    await llamar(servicio)

    const peticion = fetchFalso.mock.calls.at(-1)![0]
    expect(peticion.method).toBe(metodo)
    expect(new URL(peticion.url).pathname).toBe(ruta)
    if (cuerpo !== undefined) expect(await peticion.json()).toEqual(cuerpo)
  })

  it('consultarDisponibilidad pide el día completo de una vez (perPage 100)', async () => {
    const { servicio, fetchFalso } = armar()

    await servicio.consultarDisponibilidad(4, '2026-11-10')

    expect(Object.fromEntries(urlDe(fetchFalso).searchParams)).toEqual({ fecha: '2026-11-10', perPage: '100' })
  })

  it('listarReservas manda los filtros y la paginación', async () => {
    const { servicio, fetchFalso } = armar()

    await servicio.listarReservas({ usuarioId: 7, estado: 'CONFIRMADA', fecha: '2026-11-10' } as never, 2, 10)

    expect(Object.fromEntries(urlDe(fetchFalso).searchParams)).toEqual({
      usuarioId: '7',
      estado: 'CONFIRMADA',
      fecha: '2026-11-10',
      page: '2',
      perPage: '10',
    })
  })
})
