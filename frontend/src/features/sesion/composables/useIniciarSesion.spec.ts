import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ErrorApi } from '@/compartido/http/errores'
import { NOMBRE_RUTA_NO_ENCONTRADA } from '../acceso'

const mocks = vi.hoisted(() => ({
  store: {
    usuario: null as { rol: string | null } | null,
    iniciarSesion: vi.fn(),
  },
}))

vi.mock('../stores/sesionStore', () => ({ useSesionStore: () => mocks.store }))

import { useIniciarSesion } from './useIniciarSesion'

const CREDENCIALES = { email: 'ana@fitzone.com', contrasenia: 'secreta' }

// Router real en memoria con las rutas mínimas; el composable corre dentro de una app para tener useRouter/useRoute.
async function armar(redirect?: string) {
  const vacio = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: vacio },
      { path: '/socios', name: 'socios', component: vacio },
      { path: '/carnet', name: 'carnet', component: vacio },
      { path: '/canchas', name: 'canchas', component: vacio },
      { path: '/inicio', name: 'inicio', component: vacio },
      { path: '/:pathMatch(.*)*', name: NOMBRE_RUTA_NO_ENCONTRADA, component: vacio },
    ],
  })
  const app = createApp({ render: () => null })
  app.use(router)
  await router.push({ path: '/login', query: redirect === undefined ? {} : { redirect } })
  const estado = app.runWithContext(() => useIniciarSesion())
  return { router, ...estado }
}

describe('useIniciarSesion', () => {
  beforeEach(() => {
    mocks.store.usuario = null
    mocks.store.iniciarSesion.mockReset().mockImplementation(async () => {
      mocks.store.usuario = { rol: 'SOCIO' }
    })
  })

  describe('mensajes de error', () => {
    it('401: "El correo o la contraseña no son correctos."', async () => {
      mocks.store.iniciarSesion.mockRejectedValue(new ErrorApi(401, 'Unauthorized'))
      const { iniciarSesion, error, cargando, router } = await armar()

      await iniciarSesion(CREDENCIALES)

      expect(error.value).toBe('El correo o la contraseña no son correctos.')
      expect(cargando.value).toBe(false)
      expect(router.currentRoute.value.path).toBe('/login')
    })

    it('sin conexión (estado 0): "No se pudo conectar con el servidor"', async () => {
      mocks.store.iniciarSesion.mockRejectedValue(new ErrorApi(0, 'red'))
      const { iniciarSesion, error } = await armar()

      await iniciarSesion(CREDENCIALES)

      expect(error.value).toBe('No se pudo conectar con el servidor')
    })

    it('cualquier otro error: mensaje genérico', async () => {
      mocks.store.iniciarSesion.mockRejectedValue(new Error('boom'))
      const { iniciarSesion, error } = await armar()

      await iniciarSesion(CREDENCIALES)

      expect(error.value).toBe('No se pudo iniciar sesión. Probá de nuevo.')
    })

    it('un nuevo intento limpia el error anterior', async () => {
      mocks.store.iniciarSesion.mockRejectedValueOnce(new ErrorApi(401, 'x'))
      const { iniciarSesion, error } = await armar()
      await iniciarSesion(CREDENCIALES)
      expect(error.value).not.toBeNull()

      await iniciarSesion(CREDENCIALES)

      expect(error.value).toBeNull()
    })
  })

  describe('éxito y redirección', () => {
    it('sin ?redirect= navega a la ruta inicial del rol', async () => {
      const { iniciarSesion, router } = await armar()

      await iniciarSesion(CREDENCIALES)

      expect(mocks.store.iniciarSesion).toHaveBeenCalledWith(CREDENCIALES)
      expect(router.currentRoute.value.path).toBe('/carnet')
    })

    it('respeta un ?redirect= interno que existe', async () => {
      const { iniciarSesion, router } = await armar('/socios')

      await iniciarSesion(CREDENCIALES)

      expect(router.currentRoute.value.path).toBe('/socios')
    })

    it.each([
      ['//evil.com', 'URL con el mismo protocolo'],
      ['https://evil.com', 'URL absoluta'],
      ['/\\evil', 'barra invertida'],
      ['/no-existe', 'una ruta que solo matchea la comodín'],
      ['/login', 'la propia pantalla de login'],
    ])('rechaza el ?redirect= %s (%s) y va a la ruta inicial del rol', async (redirect) => {
      const { iniciarSesion, router } = await armar(redirect)

      await iniciarSesion(CREDENCIALES)

      expect(router.currentRoute.value.path).toBe('/carnet')
    })
  })

  it('un segundo llamado mientras está cargando no repite la llamada', async () => {
    let terminar: () => void = () => {}
    mocks.store.iniciarSesion.mockImplementation(
      () =>
        new Promise<void>((resolver) => {
          terminar = () => {
            mocks.store.usuario = { rol: 'SOCIO' }
            resolver()
          }
        }),
    )
    const { iniciarSesion, cargando } = await armar()

    const primero = iniciarSesion(CREDENCIALES)
    expect(cargando.value).toBe(true)
    await iniciarSesion(CREDENCIALES)
    expect(mocks.store.iniciarSesion).toHaveBeenCalledTimes(1)

    terminar()
    await primero
    expect(cargando.value).toBe(false)
  })
})
