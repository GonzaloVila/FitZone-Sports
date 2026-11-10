import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePenalidadCobrada } from '@/compartido/composables/usePenalidadCobrada'
import { ServiciosKey, type Servicios } from '@/compartido/servicios'
import { useUsuarioSesion } from '../composables/useUsuarioSesion'
import { useSesionStore } from './sesionStore'

// Autenticación y roles (Unidad III): el store guarda quién es el usuario (nunca el token). Se monta una app vacía con pinia y los servicios
// provistos, como hace main.ts, y el servicio de sesión es un doble.
const LOGIN_RECEPCION = {
  accessToken: 't',
  tokenType: 'Bearer',
  expiresIn: 900,
  rol: 'RECEPCION',
  usuarioId: 3,
  sedeId: 2,
}

function armar() {
  const sesion = {
    iniciarSesion: vi.fn().mockResolvedValue(LOGIN_RECEPCION),
    renovar: vi.fn().mockResolvedValue({ ...LOGIN_RECEPCION, rol: 'SOCIO', usuarioId: 7, socioId: 12, sedeId: undefined }),
    cerrarSesion: vi.fn().mockResolvedValue(undefined),
  }
  const app = createApp({})
  const pinia = createPinia()
  app.use(pinia)
  app.provide(ServiciosKey, { sesion } as unknown as Servicios)
  setActivePinia(pinia)
  return { store: useSesionStore(), sesion }
}

describe('sesionStore', () => {
  let m: ReturnType<typeof armar>

  beforeEach(() => {
    m = armar()
    usePenalidadCobrada().registrar({ id: 1, monto: 500 })
  })

  it('arranca sin usuario y sin restaurar', () => {
    expect(m.store.usuario).toBeNull()
    expect(m.store.estaAutenticado).toBe(false)
    expect(m.store.restaurada).toBe(false)
  })

  it('iniciarSesion guarda el usuario con su rol y sede, sin el token', async () => {
    await m.store.iniciarSesion({ email: 'lucas@fitzone.test', contrasenia: 'x' })

    expect(m.sesion.iniciarSesion).toHaveBeenCalledWith({ email: 'lucas@fitzone.test', contrasenia: 'x' })
    expect(m.store.usuario).toEqual({ rol: 'RECEPCION', usuarioId: 3, sedeId: 2, socioId: undefined })
    expect(m.store.estaAutenticado).toBe(true)
    expect(JSON.stringify(m.store.usuario)).not.toContain('accessToken')
  })

  it('un rol que no es del contrato queda como null (sin permisos)', async () => {
    m.sesion.iniciarSesion.mockResolvedValue({ ...LOGIN_RECEPCION, rol: 'ADMIN' })

    await m.store.iniciarSesion({ email: 'x@fitzone.test', contrasenia: 'x' })

    expect(m.store.usuario?.rol).toBeNull()
  })

  it('si el login falla, propaga el error y sigue sin usuario', async () => {
    m.sesion.iniciarSesion.mockRejectedValue(new Error('401'))

    await expect(m.store.iniciarSesion({ email: 'x@fitzone.test', contrasenia: 'x' })).rejects.toThrow('401')
    expect(m.store.usuario).toBeNull()
  })

  describe('restaurar (F5 o primera visita)', () => {
    it('recupera la sesión con la cookie de refresh', async () => {
      await m.store.restaurar()

      expect(m.store.usuario).toMatchObject({ rol: 'SOCIO', usuarioId: 7, socioId: 12 })
      expect(m.store.restaurada).toBe(true)
    })

    it('sin sesión que recuperar no es un error: queda sin usuario y marcada como restaurada', async () => {
      m.sesion.renovar.mockRejectedValue(new Error('401'))

      await expect(m.store.restaurar()).resolves.toBeUndefined()
      expect(m.store.usuario).toBeNull()
      expect(m.store.restaurada).toBe(true)
    })

    it('corre una sola vez aunque la pidan varias navegaciones a la vez', async () => {
      await Promise.all([m.store.restaurar(), m.store.restaurar(), m.store.restaurar()])
      await m.store.restaurar()

      expect(m.sesion.renovar).toHaveBeenCalledTimes(1)
    })
  })

  describe('cierre de sesión', () => {
    it('cerrarSesion avisa al servidor, borra el usuario y la penalidad cobrada', async () => {
      await m.store.iniciarSesion({ email: 'x@fitzone.test', contrasenia: 'x' })

      await m.store.cerrarSesion()

      expect(m.sesion.cerrarSesion).toHaveBeenCalledTimes(1)
      expect(m.store.usuario).toBeNull()
      expect(usePenalidadCobrada().penalidad.value).toBeNull()
    })

    it('si el servidor falla, igual borra el usuario local', async () => {
      await m.store.iniciarSesion({ email: 'x@fitzone.test', contrasenia: 'x' })
      m.sesion.cerrarSesion.mockRejectedValue(new Error('500'))

      await expect(m.store.cerrarSesion()).rejects.toThrow('500')
      expect(m.store.usuario).toBeNull()
      expect(usePenalidadCobrada().penalidad.value).toBeNull()
    })

    it('limpiar (sesión expirada) borra todo sin llamar a la API', async () => {
      await m.store.iniciarSesion({ email: 'x@fitzone.test', contrasenia: 'x' })

      m.store.limpiar()

      expect(m.sesion.cerrarSesion).not.toHaveBeenCalled()
      expect(m.store.usuario).toBeNull()
      expect(usePenalidadCobrada().penalidad.value).toBeNull()
    })
  })
})

describe('useUsuarioSesion', () => {
  it('sin sesión todo es null', () => {
    armar()

    const { rol, usuarioId, socioId, sedeId } = useUsuarioSesion()

    expect([rol.value, usuarioId.value, socioId.value, sedeId.value]).toEqual([null, null, null, null])
  })

  it('expone el rol y los ids del usuario, y se actualiza con la sesión', async () => {
    const { store } = armar()
    const datos = useUsuarioSesion()

    await store.iniciarSesion({ email: 'lucas@fitzone.test', contrasenia: 'x' })
    expect(datos.rol.value).toBe('RECEPCION')
    expect(datos.usuarioId.value).toBe(3)
    expect(datos.sedeId.value).toBe(2)
    expect(datos.socioId.value).toBeNull()

    store.limpiar()
    expect(datos.rol.value).toBeNull()
  })
})
