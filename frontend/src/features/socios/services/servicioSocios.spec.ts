import createClient from 'openapi-fetch'
import { describe, expect, it, vi } from 'vitest'
import type { paths } from '@/types/api'
import { crearServicioSocios, type ServicioSocios } from './servicioSocios'

// RF-01 / RF-02 / RF-04: socios, membresías y registro del QR. Cliente real de openapi-fetch con un `fetch` falso.
function armar() {
  const fetchFalso = vi.fn(async (peticion: Request) =>
    peticion.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({}),
  )
  const cliente = createClient<paths>({ baseUrl: 'http://api.test/api/v1', fetch: fetchFalso })
  return { servicio: crearServicioSocios(cliente), fetchFalso }
}

const casos: [string, (s: ServicioSocios) => Promise<unknown>, string, string, unknown][] = [
  ['listar', (s) => s.listar({}, 1, 20), 'GET', '/api/v1/socios', undefined],
  ['obtener', (s) => s.obtener(12), 'GET', '/api/v1/socios/12', undefined],
  ['obtenerMembresia', (s) => s.obtenerMembresia(12), 'GET', '/api/v1/socios/12/membresias', undefined],
  ['crear', (s) => s.crear({ usuarioId: 50, sedeOrigenId: 1, plan: 'MENSUAL' }), 'POST', '/api/v1/socios', { usuarioId: 50, sedeOrigenId: 1, plan: 'MENSUAL' }],
  ['modificar', (s) => s.modificar(12, { sedeOrigenId: 2 }), 'PATCH', '/api/v1/socios/12', { sedeOrigenId: 2 }],
  ['dejarDeSerSocio', (s) => s.dejarDeSerSocio(12), 'DELETE', '/api/v1/socios/12', undefined],
  ['modificarMembresia', (s) => s.modificarMembresia(12, { plan: 'ANUAL' } as never), 'PATCH', '/api/v1/socios/12/membresias', { plan: 'ANUAL' }],
  ['registrarQr', (s) => s.registrarQr(), 'POST', '/api/v1/auth/registro-qr', undefined],
]

describe('servicioSocios', () => {
  it.each(casos)('%s pide %s %s', async (_nombre, llamar, metodo, ruta, cuerpo) => {
    const { servicio, fetchFalso } = armar()

    await llamar(servicio)

    const peticion = fetchFalso.mock.calls.at(-1)![0]
    expect(peticion.method).toBe(metodo)
    expect(new URL(peticion.url).pathname).toBe(ruta)
    if (cuerpo !== undefined) expect(await peticion.json()).toEqual(cuerpo)
  })

  it('listar combina los filtros con la paginación', async () => {
    const { servicio, fetchFalso } = armar()

    await servicio.listar({ nombre: 'ana', estadoMembresia: 'VENCIDA', plan: 'MENSUAL', sedeOrigenId: 1 }, 2, 20)

    const query = new URL(fetchFalso.mock.calls.at(-1)![0].url).searchParams
    expect(Object.fromEntries(query)).toEqual({
      nombre: 'ana',
      estadoMembresia: 'VENCIDA',
      plan: 'MENSUAL',
      sedeOrigenId: '1',
      page: '2',
      perPage: '20',
    })
  })
})
