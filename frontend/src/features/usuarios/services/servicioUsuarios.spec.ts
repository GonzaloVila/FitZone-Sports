import createClient from 'openapi-fetch'
import { describe, expect, it, vi } from 'vitest'
import type { paths } from '@/types/api'
import { crearServicioUsuarios, type ServicioUsuarios } from './servicioUsuarios'

// RF-01 (personal): usuarios del sistema. Cliente real de openapi-fetch con un `fetch` falso.
function armar(paginas: { items: unknown[]; total: number }[] = []) {
  const fetchFalso = vi.fn(async (peticion: Request) => {
    const pagina = Number(new URL(peticion.url).searchParams.get('page') ?? 1)
    return Response.json(paginas[pagina - 1] ?? { items: [], total: 0 })
  })
  const cliente = createClient<paths>({ baseUrl: 'http://api.test/api/v1', fetch: fetchFalso })
  return { servicio: crearServicioUsuarios(cliente), fetchFalso }
}

const usuario = (id: number) => ({ id, rol: 'RECEPCION' })

const casos: [string, (s: ServicioUsuarios) => Promise<unknown>, string, string, unknown][] = [
  ['obtener', (s) => s.obtener(7), 'GET', '/api/v1/usuarios/7', undefined],
  ['listar', (s) => s.listar({}, 1, 20), 'GET', '/api/v1/usuarios', undefined],
  ['crear', (s) => s.crear({ email: 'lu@fitzone.test', rol: 'RECEPCION', sedeId: 2 } as never), 'POST', '/api/v1/usuarios', { email: 'lu@fitzone.test', rol: 'RECEPCION', sedeId: 2 }],
  ['modificar', (s) => s.modificar(7, { telefono: null } as never), 'PATCH', '/api/v1/usuarios/7', { telefono: null }],
]

describe('servicioUsuarios', () => {
  it.each(casos)('%s pide %s %s', async (_nombre, llamar, metodo, ruta, cuerpo) => {
    const { servicio, fetchFalso } = armar()

    await llamar(servicio)

    const peticion = fetchFalso.mock.calls.at(-1)![0]
    expect(peticion.method).toBe(metodo)
    expect(new URL(peticion.url).pathname).toBe(ruta)
    if (cuerpo !== undefined) expect(await peticion.json()).toEqual(cuerpo)
  })

  it('listar manda los filtros y la paginación', async () => {
    const { servicio, fetchFalso } = armar()

    await servicio.listar({ rol: 'RECEPCION', sedeId: 2, nombre: 'lu' }, 3, 10)

    const query = Object.fromEntries(new URL(fetchFalso.mock.calls.at(-1)![0].url).searchParams)
    expect(query).toEqual({ rol: 'RECEPCION', sedeId: '2', nombre: 'lu', page: '3', perPage: '10' })
  })

  describe('listarTodosPorRol', () => {
    it('pide todas las páginas del rol, de a 100, hasta el total', async () => {
      const { servicio, fetchFalso } = armar([
        { items: [usuario(1), usuario(2)], total: 3 },
        { items: [usuario(3)], total: 3 },
      ])

      expect(await servicio.listarTodosPorRol('RECEPCION')).toEqual([usuario(1), usuario(2), usuario(3)])
      const queries = fetchFalso.mock.calls.map(([p]) => Object.fromEntries(new URL(p.url).searchParams))
      expect(queries).toEqual([
        { rol: 'RECEPCION', page: '1', perPage: '100' },
        { rol: 'RECEPCION', page: '2', perPage: '100' },
      ])
    })

    it('corta si una página llega vacía', async () => {
      const { servicio, fetchFalso } = armar([{ items: [usuario(1)], total: 9 }])

      expect(await servicio.listarTodosPorRol('RECEPCION')).toHaveLength(1)
      expect(fetchFalso).toHaveBeenCalledTimes(2)
    })

    it('con un total inconsistente corta a las 50 páginas', async () => {
      const fetchFalso = vi.fn(async () => Response.json({ items: [usuario(1)], total: 1_000_000 }))
      const cliente = createClient<paths>({ baseUrl: 'http://api.test/api/v1', fetch: fetchFalso })

      await crearServicioUsuarios(cliente).listarTodosPorRol('GERENTE')

      expect(fetchFalso).toHaveBeenCalledTimes(50)
    })
  })
})
