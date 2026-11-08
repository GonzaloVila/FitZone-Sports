import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ServiciosKey, type Servicios } from '@/compartido/servicios'
import router from './index'

// RF-03: el guard global del router. Sin sesión solo se ven las rutas públicas (el resto va a /login con ?redirect);
// con sesión, /login y las rutas de otro rol llevan a la pantalla inicial del rol. Se usa el router real con todas las
// rutas de las features; la sesión se "restaura" con un servicio doble que responde con el rol que pida cada test.
function sesionDe(rol: string | null) {
  const renovar = rol
    ? vi.fn().mockResolvedValue({ accessToken: 't', tokenType: 'Bearer', expiresIn: 900, rol, usuarioId: 1 })
    : vi.fn().mockRejectedValue(new Error('401'))
  const app = createApp({})
  const pinia = createPinia()
  app.use(pinia)
  app.provide(ServiciosKey, { sesion: { renovar } } as unknown as Servicios)
  setActivePinia(pinia)
  return renovar
}

async function irA(ruta: string) {
  await router.push(ruta)
  return router.currentRoute.value
}

describe('guard del router', () => {
  beforeEach(async () => {
    // Cada test arranca desde una ruta neutra; la sesión se fija después.
    sesionDe(null)
    // Con query, para que ir a /login no sea una navegación duplicada (Vue Router la descarta sin pasar por el guard).
    await router.replace('/login?desde=test')
  })

  describe('sin sesión', () => {
    it('la ruta pública /login se ve', async () => {
      expect((await irA('/login')).name).toBe('login')
    })

    it('una ruta privada lleva a /login y recuerda a dónde se quería ir', async () => {
      const destino = await irA('/socios?page=2')

      expect(destino.name).toBe('login')
      expect(destino.query.redirect).toBe('/socios?page=2')
    })

    it('una ruta inexistente termina en /login', async () => {
      expect((await irA('/no-existe/para-nada')).name).toBe('login')
    })
  })

  describe('con sesión', () => {
    it.each([
      ['GERENTE', '/socios'],
      ['RECEPCION', '/socios'],
      ['SOCIO', '/carnet'],
      ['EXTERNO', '/canchas'],
    ])('%s que entra a /login va a su pantalla inicial %s', async (rol, inicial) => {
      sesionDe(rol)

      expect((await irA('/login')).path).toBe(inicial)
    })

    it('un SOCIO no puede ver la gestión de socios: va a su carnet', async () => {
      sesionDe('SOCIO')

      expect((await irA('/socios')).path).toBe('/carnet')
    })

    it('un EXTERNO no puede ver el carnet: va a canchas', async () => {
      sesionDe('EXTERNO')

      expect((await irA('/carnet')).path).toBe('/canchas')
    })

    it('el GERENTE entra a la gestión de socios', async () => {
      sesionDe('GERENTE')

      expect((await irA('/socios')).path).toBe('/socios')
    })

    it('una ruta inexistente lleva a la pantalla inicial del rol, sin bucles', async () => {
      sesionDe('SOCIO')

      expect((await irA('/no-existe')).path).toBe('/carnet')
    })

    it('un rol desconocido va a /inicio', async () => {
      sesionDe('ADMIN')

      expect((await irA('/socios')).path).toBe('/inicio')
    })
  })

  it('restaura la sesión una sola vez aunque se navegue varias veces', async () => {
    const renovar = sesionDe('GERENTE')

    await irA('/socios')
    await irA('/login')
    await irA('/socios')

    expect(renovar).toHaveBeenCalledTimes(1)
  })
})
