import createClient from 'openapi-fetch'
import { describe, expect, it, vi } from 'vitest'
import type { paths } from '@/types/api'
import { crearServicioClases, type ServicioClases } from './servicioClases'

// RF-07 / RF-08: clases, reservas de clase y lista de espera. Cliente real de openapi-fetch con un `fetch` falso.
function armar() {
  const fetchFalso = vi.fn(async (peticion: Request) =>
    peticion.method === 'DELETE' || peticion.url.endsWith('/cancelaciones')
      ? new Response(null, { status: 204 })
      : Response.json({ items: [], total: 0 }),
  )
  const cliente = createClient<paths>({ baseUrl: 'http://api.test/api/v1', fetch: fetchFalso })
  return { servicio: crearServicioClases(cliente), fetchFalso }
}

const casos: [string, (s: ServicioClases) => Promise<unknown>, string, string, unknown][] = [
  ['listar', (s) => s.listar({}, 1, 12), 'GET', '/api/v1/clases', undefined],
  ['obtener', (s) => s.obtener(30), 'GET', '/api/v1/clases/30', undefined],
  ['crear', (s) => s.crear({ tipo: 'Spinning' } as never), 'POST', '/api/v1/clases', { tipo: 'Spinning' }],
  ['listarInscriptos', (s) => s.listarInscriptos(30, 1, 50), 'GET', '/api/v1/clases/30/reservas', undefined],
  ['listarReservas', (s) => s.listarReservas({}, 1, 10), 'GET', '/api/v1/reservas-clases', undefined],
  ['reservar', (s) => s.reservar(30, 12), 'POST', '/api/v1/reservas-clases', { claseId: 30, socioId: 12 }],
  ['cancelarReserva', (s) => s.cancelarReserva(80), 'POST', '/api/v1/reservas-clases/80/cancelaciones', undefined],
  ['listarEsperaDeClase', (s) => s.listarEsperaDeClase(30, 1, 50), 'GET', '/api/v1/clases/30/espera', undefined],
  ['listarEsperas', (s) => s.listarEsperas({}, 1, 10), 'GET', '/api/v1/esperas-clases', undefined],
  ['anotarseEnEspera', (s) => s.anotarseEnEspera(30, 12), 'POST', '/api/v1/clases/30/espera', { socioId: 12 }],
  ['salirDeEspera', (s) => s.salirDeEspera(5), 'DELETE', '/api/v1/esperas-clases/5', undefined],
  ['confirmarEspera', (s) => s.confirmarEspera(5), 'POST', '/api/v1/esperas-clases/5/confirmaciones', undefined],
]

describe('servicioClases', () => {
  it.each(casos)('%s pide %s %s', async (_nombre, llamar, metodo, ruta, cuerpo) => {
    const { servicio, fetchFalso } = armar()

    await llamar(servicio)

    const peticion = fetchFalso.mock.calls.at(-1)![0]
    expect(peticion.method).toBe(metodo)
    expect(new URL(peticion.url).pathname).toBe(ruta)
    if (cuerpo !== undefined) expect(await peticion.json()).toEqual(cuerpo)
  })

  it.each([
    ['listar', (s: ServicioClases) => s.listar({ tipo: 'Yoga', sedeId: 2, estado: 'PROXIMAS' } as never, 2, 12), { tipo: 'Yoga', sedeId: '2', estado: 'PROXIMAS', page: '2', perPage: '12' }],
    ['listarReservas', (s: ServicioClases) => s.listarReservas({ socioId: 12, estado: 'CONFIRMADA' }, 1, 10), { socioId: '12', estado: 'CONFIRMADA', page: '1', perPage: '10' }],
    ['listarEsperas', (s: ServicioClases) => s.listarEsperas({ claseId: 30 }, 1, 10), { claseId: '30', page: '1', perPage: '10' }],
    ['listarInscriptos', (s: ServicioClases) => s.listarInscriptos(30, 3, 50), { page: '3', perPage: '50' }],
  ])('%s manda filtros y paginación como query', async (_nombre, llamar, query) => {
    const { servicio, fetchFalso } = armar()

    await llamar(servicio)

    expect(Object.fromEntries(new URL(fetchFalso.mock.calls.at(-1)![0].url).searchParams)).toEqual(query)
  })
})
