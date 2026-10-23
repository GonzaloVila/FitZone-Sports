import createClient, { type Client } from 'openapi-fetch'
import type { paths } from '@/types/api'
import type { AlmacenToken } from './almacenToken'
import { crearErrorDeRed, crearErrorDeRespuesta } from './errores'

export type ClienteApi = Client<paths>

export interface OpcionesClienteApi {
  baseUrl: string
  almacenToken: AlmacenToken
  alExpirarSesion: () => void
}

// Operaciones de autenticación: no pasan por la lógica de renovación ante 401 (evita bucles).
const RUTA_RENOVACION = '/auth/refresh' satisfies keyof paths
const RUTAS_AUTENTICACION = ['/auth/login', RUTA_RENOVACION, '/auth/logout'] as const satisfies readonly (keyof paths)[]

function coincideConRuta(peticion: Request, rutas: readonly string[]): boolean {
  const { pathname } = new URL(peticion.url)
  return rutas.some((ruta) => pathname.endsWith(ruta))
}

export function crearClienteApi({ baseUrl, almacenToken, alExpirarSesion }: OpcionesClienteApi): ClienteApi {
  // Una falla de conexión no tiene respuesta HTTP: se traduce a ErrorApi con status 0.
  async function fetchRed(peticion: Request): Promise<Response> {
    try {
      return await fetch(peticion)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      throw crearErrorDeRed()
    }
  }

  // El backend rota el refresh token y detecta reuso: dos renovaciones en paralelo lo invalidarían.
  // Todas las llamadas a /auth/refresh (automáticas o explícitas) se ejecutan de a una.
  let colaRenovacion: Promise<unknown> = Promise.resolve()
  function enSerie<T>(tarea: () => Promise<T>): Promise<T> {
    const resultado = colaRenovacion.then(tarea)
    colaRenovacion = resultado.catch(() => undefined)
    return resultado
  }

  // Cliente aparte para la renovación automática: no usa la lógica de 401.
  const clienteRenovacion = createClient<paths>({
    baseUrl,
    credentials: 'include',
    fetch: (peticion) => enSerie(() => fetchRed(peticion)),
  })

  async function renovar(): Promise<boolean> {
    try {
      const { data } = await clienteRenovacion.POST(RUTA_RENOVACION)
      if (!data) return false
      almacenToken.guardar(data.accessToken)
      return true
    } catch {
      return false
    }
  }

  // Las renovaciones concurrentes comparten una sola promesa en vuelo.
  let renovacionEnCurso: Promise<boolean> | null = null
  function renovarCompartido(): Promise<boolean> {
    renovacionEnCurso ??= renovar().finally(() => {
      renovacionEnCurso = null
    })
    return renovacionEnCurso
  }

  function expirarSesion() {
    almacenToken.guardar(null)
    alExpirarSesion()
  }

  function conToken(peticion: Request): Request {
    const token = almacenToken.obtener()
    if (token) peticion.headers.set('Authorization', `Bearer ${token}`)
    return peticion
  }

  async function fetchPropio(peticion: Request): Promise<Response> {
    if (coincideConRuta(peticion, [RUTA_RENOVACION])) return enSerie(() => fetchRed(peticion))
    if (coincideConRuta(peticion, RUTAS_AUTENTICACION)) return fetchRed(peticion)

    // Se clona antes del primer intento: el cuerpo se consume al enviar y hace falta para reintentar.
    const copia = peticion.clone()
    const tokenUsado = almacenToken.obtener()
    const respuesta = await fetchRed(conToken(peticion))
    if (respuesta.status !== 401) return respuesta

    // Si el token cambió mientras la petición estaba en vuelo, otra petición ya renovó: solo se reintenta.
    const yaRenovado = almacenToken.obtener() !== tokenUsado
    if (!yaRenovado && !(await renovarCompartido())) {
      expirarSesion()
      return respuesta
    }

    const reintento = await fetchRed(conToken(copia))
    if (reintento.status === 401) expirarSesion()
    return reintento
  }

  return createClient<paths>({ baseUrl, credentials: 'include', fetch: fetchPropio })
}

type Resultado = { data?: unknown; error?: unknown; response: Response }

// Devuelve los datos de una respuesta exitosa o lanza ErrorApi (con el problem+json parseado si viene).
export function desenvolver<R extends Resultado>(resultado: R): Exclude<R["data"], undefined> {
  const { response } = resultado
  if (!response.ok) throw crearErrorDeRespuesta(response.status, resultado.error, response.statusText)
  return resultado.data as Exclude<R["data"], undefined>
}
