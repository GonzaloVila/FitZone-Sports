import createClient from 'openapi-fetch'
import { describe, expect, it, vi } from 'vitest'
import type { paths } from '@/types/api'
import { ErrorApi } from '@/compartido/http/errores'
import { crearServicioPagos, type ServicioPagos } from './servicioPagos'

// RF-13 / RF-14: cobros, anulaciones, comprobante PDF y reporte. Cliente real de openapi-fetch con un `fetch` falso.
function armar(respuesta: (peticion: Request) => Response = () => Response.json({ items: [], total: 0 })) {
  const fetchFalso = vi.fn(async (peticion: Request) => respuesta(peticion))
  const cliente = createClient<paths>({ baseUrl: 'http://api.test/api/v1', fetch: fetchFalso })
  return { servicio: crearServicioPagos(cliente), fetchFalso }
}

const pdf = () => new Response('%PDF-1.7', {
  status: 200,
  headers: { 'Content-Type': 'application/pdf' },
})

const PROBLEMA = { type: 'pago-no-aprobado', title: 'El pago no tiene comprobante', status: 409, detail: 'Solo los pagos aprobados tienen comprobante.' }

const casos: [string, (s: ServicioPagos) => Promise<unknown>, string, string][] = [
  ['procesar', (s) => s.procesar({ concepto: 'RESERVA_CANCHA' } as never, 'clave-1'), 'POST', '/api/v1/pagos'],
  ['listar', (s) => s.listar({}, 1, 20), 'GET', '/api/v1/pagos'],
  ['obtener', (s) => s.obtener(9), 'GET', '/api/v1/pagos/9'],
  ['anular', (s) => s.anular(9), 'POST', '/api/v1/pagos/9/anulaciones'],
]

describe('servicioPagos', () => {
  it.each(casos)('%s pide %s %s', async (_nombre, llamar, metodo, ruta) => {
    const { servicio, fetchFalso } = armar()

    await llamar(servicio)

    const peticion = fetchFalso.mock.calls.at(-1)![0]
    expect(peticion.method).toBe(metodo)
    expect(new URL(peticion.url).pathname).toBe(ruta)
  })

  it('procesar manda la clave de idempotencia en el header y el pago en el cuerpo', async () => {
    const { servicio, fetchFalso } = armar()

    await servicio.procesar({ concepto: 'RESERVA_CANCHA', reservaCanchaId: 4 } as never, 'clave-unica-123')

    const peticion = fetchFalso.mock.calls.at(-1)![0]
    expect(peticion.headers.get('Idempotency-Key')).toBe('clave-unica-123')
    expect(await peticion.json()).toEqual({ concepto: 'RESERVA_CANCHA', reservaCanchaId: 4 })
  })

  it('listar manda los filtros y la paginación', async () => {
    const { servicio, fetchFalso } = armar()

    await servicio.listar({ usuarioId: 7, estado: 'APROBADO', desde: '2026-11-01', hasta: '2026-11-30' }, 2, 20)

    expect(Object.fromEntries(new URL(fetchFalso.mock.calls.at(-1)![0].url).searchParams)).toEqual({
      usuarioId: '7',
      estado: 'APROBADO',
      desde: '2026-11-01',
      hasta: '2026-11-30',
      page: '2',
      perPage: '20',
    })
  })

  describe('descargas en PDF', () => {
    it('descargarComprobante pide GET /pagos/{id}/comprobante y devuelve el PDF como Blob', async () => {
      const { servicio, fetchFalso } = armar(pdf)

      const archivo = await servicio.descargarComprobante(9)

      expect(new URL(fetchFalso.mock.calls.at(-1)![0].url).pathname).toBe('/api/v1/pagos/9/comprobante')
      expect(archivo).toBeInstanceOf(Blob)
      expect(await archivo.text()).toBe('%PDF-1.7')
    })

    it('descargarReporte pide GET /reportes/pagos con el rango de fechas', async () => {
      const { servicio, fetchFalso } = armar(pdf)

      await servicio.descargarReporte('2026-11-01', '2026-11-30')

      const url = new URL(fetchFalso.mock.calls.at(-1)![0].url)
      expect(url.pathname).toBe('/api/v1/reportes/pagos')
      expect(url.searchParams.get('desde')).toBe('2026-11-01')
      expect(url.searchParams.get('hasta')).toBe('2026-11-30')
    })

    it('un error del servidor llega como ErrorApi con el problem+json leído del Blob', async () => {
      const { servicio } = armar(
        () => new Response(JSON.stringify(PROBLEMA), { status: 409, headers: { 'Content-Type': 'application/problem+json' } }),
      )

      const error = await servicio.descargarComprobante(9).catch((e) => e)

      expect(error).toBeInstanceOf(ErrorApi)
      expect(error.status).toBe(409)
      expect(error.problema).toMatchObject({ type: 'pago-no-aprobado' })
    })

    it('si el cuerpo del error no es JSON, arma un problema mínimo con el status', async () => {
      const { servicio } = armar(() => new Response('se cayó todo', { status: 500, statusText: 'Internal Server Error' }))

      const error = await servicio.descargarReporte().catch((e) => e)

      expect(error).toBeInstanceOf(ErrorApi)
      expect(error.status).toBe(500)
      expect(error.problema).toMatchObject({ type: 'about:blank', title: 'Internal Server Error', status: 500 })
    })
  })
})
