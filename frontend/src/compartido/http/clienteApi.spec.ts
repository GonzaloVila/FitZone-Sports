import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { crearAlmacenToken } from './almacenToken'
import { crearClienteApi } from './clienteApi'

const BASE = 'http://localhost/api/v1'

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

// Un servidor falso: una petición con el token vigente responde 200 y con otro, 401. La renovación espera a que el test la
// libere (así las demás peticiones alcanzan a recibir su 401 mientras sigue en vuelo) y entrega el token siguiente.
function armarServidor(tokenVigente: string, renovacion: 'ok' | 'rechazada' = 'ok') {
  const estado = {
    vigente: tokenVigente,
    renovaciones: 0,
    renovacionesSimultaneas: 0,
    maximoSimultaneas: 0,
    respuestas401: 0,
    liberar: () => {},
  }
  let compuerta = new Promise<void>((resolver) => (estado.liberar = resolver))

  const manejar = vi.fn(async (peticion: Request): Promise<Response> => {
    if (new URL(peticion.url).pathname.endsWith('/auth/refresh')) {
      estado.renovaciones++
      estado.renovacionesSimultaneas++
      estado.maximoSimultaneas = Math.max(estado.maximoSimultaneas, estado.renovacionesSimultaneas)
      await compuerta
      compuerta = new Promise<void>((resolver) => (estado.liberar = resolver))
      estado.renovacionesSimultaneas--
      if (renovacion === 'rechazada') return new Response(null, { status: 401 })
      estado.vigente = `token-${estado.renovaciones}`
      return json({ accessToken: estado.vigente })
    }
    if (peticion.headers.get('Authorization') === `Bearer ${estado.vigente}`) return json({ items: [], total: 0 })
    estado.respuestas401++
    return new Response(null, { status: 401 })
  })
  vi.stubGlobal('fetch', manejar)
  return { estado, manejar }
}

describe('crearClienteApi: renovación del token ante 401', () => {
  let almacenToken: ReturnType<typeof crearAlmacenToken>
  let alExpirarSesion: Mock<() => void>

  beforeEach(() => {
    almacenToken = crearAlmacenToken()
    alExpirarSesion = vi.fn<() => void>()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const crear = () => crearClienteApi({ baseUrl: BASE, almacenToken, alExpirarSesion })

  it('varias peticiones que reciben 401 a la vez hacen UNA sola renovación y todas se reintentan con el token nuevo', async () => {
    const { estado } = armarServidor('vigente')
    almacenToken.guardar('vencido')
    const cliente = crear()

    const llamadas = [cliente.GET('/clases'), cliente.GET('/clases'), cliente.GET('/clases')]
    await vi.waitFor(() => expect(estado.respuestas401).toBe(3))
    estado.liberar()
    const respuestas = await Promise.all(llamadas)

    expect(estado.renovaciones).toBe(1)
    expect(respuestas.map((r) => r.response.status)).toEqual([200, 200, 200])
    expect(almacenToken.obtener()).toBe('token-1')
    expect(alExpirarSesion).not.toHaveBeenCalled()
  })

  it('al terminar una renovación la promesa compartida se limpia: un 401 posterior renueva de nuevo', async () => {
    const { estado } = armarServidor('vigente')
    almacenToken.guardar('vencido')
    const cliente = crear()

    const primera = cliente.GET('/clases')
    await vi.waitFor(() => expect(estado.respuestas401).toBe(1))
    estado.liberar()
    await primera
    expect(estado.renovaciones).toBe(1)

    estado.vigente = 'otro-token'
    const segunda = cliente.GET('/clases')
    await vi.waitFor(() => expect(estado.renovaciones).toBe(2))
    estado.liberar()

    expect((await segunda).response.status).toBe(200)
    expect(estado.renovaciones).toBe(2)
  })

  it('si la renovación falla cierra la sesión, sin reintentos en bucle, y las peticiones esperando reciben su 401', async () => {
    const { estado } = armarServidor('vigente', 'rechazada')
    almacenToken.guardar('vencido')
    const cliente = crear()

    const llamadas = [cliente.GET('/clases'), cliente.GET('/clases'), cliente.GET('/clases')]
    await vi.waitFor(() => expect(estado.respuestas401).toBe(3))
    estado.liberar()
    const respuestas = await Promise.all(llamadas)

    expect(estado.renovaciones).toBe(1)
    expect(respuestas.map((r) => r.response.status)).toEqual([401, 401, 401])
    expect(almacenToken.obtener()).toBeNull()
    expect(alExpirarSesion).toHaveBeenCalled()
  })

  it('tras una renovación fallida la promesa también se limpia: una petición nueva puede volver a intentarlo', async () => {
    const { estado } = armarServidor('vigente', 'rechazada')
    almacenToken.guardar('vencido')
    const cliente = crear()

    const primera = cliente.GET('/clases')
    await vi.waitFor(() => expect(estado.renovaciones).toBe(1))
    estado.liberar()
    await primera

    almacenToken.guardar('vencido')
    const segunda = cliente.GET('/clases')
    await vi.waitFor(() => expect(estado.renovaciones).toBe(2))
    estado.liberar()
    await segunda

    expect(estado.renovaciones).toBe(2)
  })

  it('las renovaciones explícitas (POST /auth/refresh) nunca corren en paralelo', async () => {
    const { estado } = armarServidor('vigente')
    const cliente = crear()

    const llamadas = [cliente.POST('/auth/refresh'), cliente.POST('/auth/refresh')]
    await vi.waitFor(() => expect(estado.renovaciones).toBe(1))
    estado.liberar()
    await vi.waitFor(() => expect(estado.renovaciones).toBe(2))
    estado.liberar()
    await Promise.all(llamadas)

    expect(estado.maximoSimultaneas).toBe(1)
  })
})
