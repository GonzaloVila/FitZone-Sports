import createClient from 'openapi-fetch'
import { describe, expect, it, vi } from 'vitest'
import type { paths } from '@/types/api'
import { ErrorApi } from '@/compartido/http/errores'
import { crearServicioAcceso, type ServicioAcceso } from './servicioAcceso'

// RF-05 / RF-06 / RN-01: aforo, ingresos, egresos y sincronización offline. Cliente real de openapi-fetch con un
// `fetch` falso: se mira qué petición sale hacia el contrato.
function armar(respuesta: () => Response = () => Response.json({})) {
  const fetchFalso = vi.fn(async (_peticion: Request) => respuesta())
  const cliente = createClient<paths>({ baseUrl: 'http://api.test/api/v1', fetch: fetchFalso })
  return { servicio: crearServicioAcceso(cliente), fetchFalso }
}

const casos: [string, (s: ServicioAcceso) => Promise<unknown>, string, string, unknown][] = [
  ['obtenerAforo', (s) => s.obtenerAforo(3), 'GET', '/api/v1/sedes/3/aforo', undefined],
  ['registrarIngreso', (s) => s.registrarIngreso({ socioId: 12, sedeId: 3 } as never), 'POST', '/api/v1/ingresos', { socioId: 12, sedeId: 3 }],
  ['registrarEgreso', (s) => s.registrarEgreso(40), 'POST', '/api/v1/ingresos/40/egreso', undefined],
  ['listarIngresos', (s) => s.listarIngresos(), 'GET', '/api/v1/ingresos', undefined],
  ['obtenerIngreso', (s) => s.obtenerIngreso(40), 'GET', '/api/v1/ingresos/40', undefined],
  ['sincronizarIngresos', (s) => s.sincronizarIngresos({ ingresos: [] } as never), 'POST', '/api/v1/sincronizacion/ingresos', { ingresos: [] }],
  ['listarBloqueados', (s) => s.listarBloqueados(), 'GET', '/api/v1/bloqueados', undefined],
]

describe('servicioAcceso', () => {
  it.each(casos)('%s pide %s %s', async (_nombre, llamar, metodo, ruta, cuerpo) => {
    const { servicio, fetchFalso } = armar()

    await llamar(servicio)

    const peticion = fetchFalso.mock.calls.at(-1)![0]
    expect(peticion.method).toBe(metodo)
    expect(new URL(peticion.url).pathname).toBe(ruta)
    if (cuerpo !== undefined) expect(await peticion.json()).toEqual(cuerpo)
  })

  it('listarIngresos manda los filtros como query', async () => {
    const { servicio, fetchFalso } = armar()

    await servicio.listarIngresos({ sedeId: 3, abiertos: true } as never)

    const url = new URL(fetchFalso.mock.calls.at(-1)![0].url)
    expect(url.searchParams.get('sedeId')).toBe('3')
    expect(url.searchParams.get('abiertos')).toBe('true')
  })

  it('listarBloqueados: sin fecha pide la lista completa; con fecha, solo los cambios (RNF-01)', async () => {
    const { servicio, fetchFalso } = armar()

    await servicio.listarBloqueados()
    expect(new URL(fetchFalso.mock.calls.at(-1)![0].url).searchParams.has('actualizadoDesde')).toBe(false)

    await servicio.listarBloqueados('2026-11-09T12:00:00Z')
    expect(new URL(fetchFalso.mock.calls.at(-1)![0].url).searchParams.get('actualizadoDesde')).toBe('2026-11-09T12:00:00Z')
  })

  it('devuelve el aforo tal cual lo manda el servidor', async () => {
    const aforo = { sedeId: 3, ocupacion: 40, capacidad: 120 }
    const { servicio } = armar(() => Response.json(aforo))

    await expect(servicio.obtenerAforo(3)).resolves.toEqual(aforo)
  })

  it('un ingreso rechazado por RN-01 (409) llega como ErrorApi con el problema del contrato', async () => {
    const problema = { type: 'ingreso-abierto', title: 'El socio ya está dentro de otra sede', status: 409, detail: 'Tiene un ingreso abierto en otra sede.' }
    const { servicio } = armar(
      () => new Response(JSON.stringify(problema), { status: 409, headers: { 'Content-Type': 'application/problem+json' } }),
    )

    const error = await servicio.registrarIngreso({ socioId: 12, sedeId: 3 } as never).catch((e) => e)

    expect(error).toBeInstanceOf(ErrorApi)
    expect(error.status).toBe(409)
    expect(error.problema).toMatchObject({ type: 'ingreso-abierto' })
  })
})
