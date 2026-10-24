import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type Ref } from 'vue'

const mocks = vi.hoisted(() => ({
  obtener: vi.fn(),
  listarSedes: vi.fn(),
  usuarioId: null as unknown as Ref<number | null>,
  sedeId: null as unknown as Ref<number | null>,
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ usuarios: { obtener: mocks.obtener }, sedes: { listar: mocks.listarSedes } }),
}))

vi.mock('./useUsuarioSesion', () => ({
  useUsuarioSesion: () => ({ usuarioId: mocks.usuarioId, sedeId: mocks.sedeId }),
}))

import { usePerfilSesion } from './usePerfilSesion'

function armar() {
  const scope = effectScope()
  const estado = scope.run(() => usePerfilSesion())!
  return { ...estado, detener: () => scope.stop() }
}

describe('usePerfilSesion', () => {
  beforeEach(() => {
    mocks.obtener.mockReset()
    mocks.listarSedes.mockReset()
    mocks.usuarioId = ref<number | null>(7)
    mocks.sedeId = ref<number | null>(null)
  })

  it('carga el nombre y el email del usuario una sola vez', async () => {
    mocks.obtener.mockResolvedValue({ id: 7, nombre: 'Ana Gómez', email: 'ana@fitzone.test' })
    const { nombre, email, cargando, detener } = armar()
    expect(cargando.value).toBe(true)

    await vi.waitFor(() => expect(nombre.value).toBe('Ana Gómez'))

    expect(email.value).toBe('ana@fitzone.test')
    expect(cargando.value).toBe(false)
    expect(mocks.obtener).toHaveBeenCalledTimes(1)
    expect(mocks.obtener).toHaveBeenCalledWith(7, expect.any(AbortSignal))
    detener()
  })

  it('si falla, nombre y email quedan en null y no se propaga ningún error', async () => {
    mocks.obtener.mockRejectedValue(new Error('403'))
    const { nombre, email, cargando, detener } = armar()

    await vi.waitFor(() => expect(cargando.value).toBe(false))

    expect(nombre.value).toBeNull()
    expect(email.value).toBeNull()
    detener()
  })

  it('sin usuarioId no consulta nada', () => {
    mocks.usuarioId = ref<number | null>(null)
    const { nombre, cargando, detener } = armar()

    expect(mocks.obtener).not.toHaveBeenCalled()
    expect(nombre.value).toBeNull()
    expect(cargando.value).toBe(false)
    detener()
  })

  it('aborta la consulta al desmontar y descarta la respuesta tardía', async () => {
    let resolver: (usuario: unknown) => void = () => {}
    mocks.obtener.mockReturnValue(new Promise((resolve) => (resolver = resolve)))
    const { nombre, detener } = armar()
    const senal = mocks.obtener.mock.calls[0]![1] as AbortSignal

    detener()
    expect(senal.aborted).toBe(true)

    resolver({ id: 7, nombre: 'Ana Gómez', email: 'ana@fitzone.test' })
    await Promise.resolve()
    expect(nombre.value).toBeNull()
  })

  it('al cambiar el usuarioId aborta la consulta anterior y pide la del nuevo', async () => {
    mocks.obtener.mockReturnValueOnce(new Promise(() => {})).mockResolvedValueOnce({ id: 8, nombre: 'Luis', email: 'luis@fitzone.test' })
    const { nombre, detener } = armar()
    const primera = mocks.obtener.mock.calls[0]![1] as AbortSignal

    mocks.usuarioId.value = 8

    await vi.waitFor(() => expect(nombre.value).toBe('Luis'))
    expect(primera.aborted).toBe(true)
    expect(mocks.obtener).toHaveBeenCalledTimes(2)
    expect(mocks.obtener).toHaveBeenLastCalledWith(8, expect.any(AbortSignal))
    detener()
  })

  it('sin sedeId (GERENTE) no consulta las sedes', () => {
    mocks.obtener.mockReturnValue(new Promise(() => {}))
    const { nombreSede, detener } = armar()

    expect(mocks.listarSedes).not.toHaveBeenCalled()
    expect(nombreSede.value).toBeNull()
    detener()
  })

  describe('nombre de la sede (RECEPCION)', () => {
    const sedes = [
      { id: 1, nombre: 'Sede Centro', direccion: 'A', aforoMaximo: 10 },
      { id: 2, nombre: 'Sede Norte', direccion: 'B', aforoMaximo: 20 },
    ]

    beforeEach(() => {
      mocks.obtener.mockReturnValue(new Promise(() => {}))
      mocks.sedeId = ref<number | null>(2)
    })

    it('encuentra la sede por id, una sola vez', async () => {
      mocks.listarSedes.mockResolvedValue(sedes)
      const { nombreSede, detener } = armar()

      await vi.waitFor(() => expect(nombreSede.value).toBe('Sede Norte'))

      expect(mocks.listarSedes).toHaveBeenCalledTimes(1)
      expect(mocks.listarSedes).toHaveBeenCalledWith(expect.any(AbortSignal))
      detener()
    })

    it('si la consulta falla, queda en null sin propagar el error', async () => {
      mocks.listarSedes.mockRejectedValue(new Error('500'))
      const { nombreSede, detener } = armar()

      await vi.waitFor(() => expect(mocks.listarSedes).toHaveBeenCalled())
      await Promise.resolve()

      expect(nombreSede.value).toBeNull()
      detener()
    })

    it('si la sede no está en el listado, queda en null', async () => {
      mocks.sedeId = ref<number | null>(99)
      mocks.listarSedes.mockResolvedValue(sedes)
      const { nombreSede, detener } = armar()

      await vi.waitFor(() => expect(mocks.listarSedes).toHaveBeenCalled())
      await Promise.resolve()

      expect(nombreSede.value).toBeNull()
      detener()
    })

    it('aborta la consulta al desmontar y descarta la respuesta tardía', async () => {
      let resolver: (lista: unknown) => void = () => {}
      mocks.listarSedes.mockReturnValue(new Promise((resolve) => (resolver = resolve)))
      const { nombreSede, detener } = armar()
      const senal = mocks.listarSedes.mock.calls[0]![0] as AbortSignal

      detener()
      expect(senal.aborted).toBe(true)

      resolver(sedes)
      await Promise.resolve()
      expect(nombreSede.value).toBeNull()
    })
  })
})
