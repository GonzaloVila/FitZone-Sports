import createClient from 'openapi-fetch'
import { describe, expect, it, vi } from 'vitest'
import type { paths } from '@/types/api'
import { crearAlmacenToken } from '@/compartido/http/almacenToken'
import { ErrorApi } from '@/compartido/http/errores'
import { crearServicioSesion } from './servicioSesion'

// Autenticación y roles (Unidad III): login, renovación y cierre de sesión. Se usa el cliente real de openapi-fetch con un `fetch` falso: se mira
// qué petición sale y qué queda en el almacén del access token (solo en memoria).
const SESION = {
  accessToken: 'token-nuevo',
  tokenType: 'Bearer',
  expiresIn: 900,
  rol: 'SOCIO',
  usuarioId: 7,
  socioId: 12,
}

const PROBLEMA = { type: 'about:blank', title: 'Credenciales inválidas', status: 401 }

function armar(respuesta: () => Response = () => Response.json(SESION)) {
  const fetchFalso = vi.fn(async (_peticion: Request) => respuesta())
  const cliente = createClient<paths>({ baseUrl: 'http://api.test/api/v1', fetch: fetchFalso })
  const almacen = crearAlmacenToken()
  return { servicio: crearServicioSesion(cliente, almacen), fetchFalso, almacen }
}

function ultimaPeticion(fetchFalso: ReturnType<typeof armar>['fetchFalso']): Request {
  const peticion = fetchFalso.mock.calls.at(-1)?.[0]
  if (!peticion) throw new Error('No se hizo ninguna petición')
  return peticion
}

const problema = () => new Response(JSON.stringify(PROBLEMA), {
  status: 401,
  headers: { 'Content-Type': 'application/problem+json' },
})

describe('servicioSesion.iniciarSesion', () => {
  it('manda POST /auth/login con las credenciales y guarda el access token', async () => {
    const { servicio, fetchFalso, almacen } = armar()

    const sesion = await servicio.iniciarSesion({ email: 'ana@fitzone.test', contrasenia: 'Password123!' })

    const peticion = ultimaPeticion(fetchFalso)
    expect(new URL(peticion.url).pathname).toBe('/api/v1/auth/login')
    expect(peticion.method).toBe('POST')
    expect(await peticion.json()).toEqual({ email: 'ana@fitzone.test', contrasenia: 'Password123!' })
    expect(sesion).toEqual(SESION)
    expect(almacen.obtener()).toBe('token-nuevo')
  })

  it('con credenciales inválidas lanza ErrorApi 401 y no guarda ningún token', async () => {
    const { servicio, almacen } = armar(problema)

    const error = await servicio.iniciarSesion({ email: 'x@fitzone.test', contrasenia: 'mala' }).catch((e) => e)

    expect(error).toBeInstanceOf(ErrorApi)
    expect(error.status).toBe(401)
    expect(almacen.obtener()).toBeNull()
  })
})

describe('servicioSesion.renovar', () => {
  it('manda POST /auth/refresh (la cookie viaja sola) y guarda el token nuevo', async () => {
    const { servicio, fetchFalso, almacen } = armar()

    await servicio.renovar()

    expect(new URL(ultimaPeticion(fetchFalso).url).pathname).toBe('/api/v1/auth/refresh')
    expect(almacen.obtener()).toBe('token-nuevo')
  })

  it('si no hay sesión que renovar, propaga el 401', async () => {
    const { servicio } = armar(problema)

    await expect(servicio.renovar()).rejects.toBeInstanceOf(ErrorApi)
  })
})

describe('servicioSesion.cerrarSesion', () => {
  it('manda POST /auth/logout y descarta el token local', async () => {
    const { servicio, fetchFalso, almacen } = armar(() => new Response(null, { status: 204 }))
    almacen.guardar('token-viejo')

    await servicio.cerrarSesion()

    expect(new URL(ultimaPeticion(fetchFalso).url).pathname).toBe('/api/v1/auth/logout')
    expect(almacen.obtener()).toBeNull()
  })

  it('aunque el servidor falle, el token local se descarta igual', async () => {
    const { servicio, almacen } = armar(() => new Response(null, { status: 500 }))
    almacen.guardar('token-viejo')

    await expect(servicio.cerrarSesion()).rejects.toBeInstanceOf(ErrorApi)
    expect(almacen.obtener()).toBeNull()
  })
})
