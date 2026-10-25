import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  obtenerMembresia: vi.fn(),
  modificarMembresia: vi.fn(),
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ socios: mocks }),
}))

import type { Membresia, Socio } from '../services/servicioSocios'
import { useListaSocios } from './useListaSocios'

const socio = (id: number): Socio => ({
  id,
  usuarioId: id + 100,
  sedeOrigenId: 1,
  fechaAlta: '2026-01-01T00:00:00-03:00',
  nombre: `Socio ${id}`,
  email: `socio${id}@fitzone.com`,
})

const membresia = (plan: Membresia['plan'] = 'MENSUAL', estado: Membresia['estado'] = 'ACTIVA'): Membresia => ({
  id: 1,
  plan,
  estado,
  fechaInicio: '2026-01-01T00:00:00-03:00',
  fechaFin: '2026-02-01T00:00:00-03:00',
  renuevaAutomatica: false,
})

function diferida<T>() {
  let resolver!: (valor: T) => void
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve
  })
  return { promesa, resolver }
}

async function vaciar() {
  for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(0)
}

let scope: EffectScope

async function armar() {
  scope = effectScope()
  const lista = scope.run(() => useListaSocios())!
  await vaciar()
  return lista
}

describe('useListaSocios: reemplazarMembresia y recargar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.listar.mockReset().mockResolvedValue({ items: [socio(1), socio(2)], total: 2 })
    mocks.obtenerMembresia.mockReset().mockResolvedValue(membresia())
    mocks.modificarMembresia.mockReset()
  })

  afterEach(() => {
    scope?.stop()
    vi.useRealTimers()
  })

  it('reemplazarMembresia actualiza solo esa fila con lo recibido, sin volver a consultar', async () => {
    const { items, reemplazarMembresia } = await armar()
    mocks.listar.mockClear()
    mocks.obtenerMembresia.mockClear()

    reemplazarMembresia(2, membresia('ANUAL', 'SUSPENDIDA'))

    expect(items.value[1]?.membresia).toEqual({ situacion: 'disponible', membresia: membresia('ANUAL', 'SUSPENDIDA') })
    expect(items.value[0]?.membresia).toEqual({ situacion: 'disponible', membresia: membresia() })
    expect(mocks.listar).not.toHaveBeenCalled()
    expect(mocks.obtenerMembresia).not.toHaveBeenCalled()
  })

  it('reemplazarMembresia con un socio que no está en la página no hace nada', async () => {
    const { items, reemplazarMembresia } = await armar()

    reemplazarMembresia(99, membresia('ANUAL'))

    expect(items.value.map((fila) => fila.membresia)).toEqual([
      { situacion: 'disponible', membresia: membresia() },
      { situacion: 'disponible', membresia: membresia() },
    ])
  })

  it('reemplazarMembresia también reemplaza una membresía que no estaba disponible', async () => {
    mocks.obtenerMembresia.mockImplementation((id: number) => (id === 1 ? Promise.reject(new Error('falla')) : Promise.resolve(membresia())))
    const { items, reemplazarMembresia } = await armar()
    expect(items.value[0]?.membresia).toEqual({ situacion: 'no-disponible' })

    reemplazarMembresia(1, membresia('TRIMESTRAL'))

    expect(items.value[0]?.membresia).toEqual({ situacion: 'disponible', membresia: membresia('TRIMESTRAL') })
  })

  it('recargar vuelve a consultar la página actual con los mismos filtros', async () => {
    mocks.listar.mockResolvedValue({ items: [socio(1)], total: 25 })
    const { filtros, pagina, recargar } = await armar()
    filtros.estado = 'ACTIVA'
    await vaciar()
    pagina.value = 2
    await vaciar()
    mocks.listar.mockClear()
    mocks.listar.mockResolvedValue({ items: [socio(11)], total: 24 })

    await recargar()
    await vaciar()

    expect(mocks.listar).toHaveBeenCalledTimes(1)
    expect(mocks.listar).toHaveBeenCalledWith(expect.objectContaining({ estadoMembresia: 'ACTIVA' }), 2, 10, expect.any(AbortSignal))
  })

  it('recargar refleja que una fila ya no está (por ejemplo, tras una baja)', async () => {
    const { items, total, recargar } = await armar()
    mocks.listar.mockResolvedValue({ items: [socio(2)], total: 1 })

    await recargar()
    await vaciar()

    expect(items.value.map((fila) => fila.socio.id)).toEqual([2])
    expect(total.value).toBe(1)
  })

  it('una respuesta vieja de recargar se descarta si llegó otra consulta después', async () => {
    const primera = diferida<{ items: Socio[]; total: number }>()
    const { items, filtros, recargar } = await armar()
    mocks.listar.mockReset().mockReturnValueOnce(primera.promesa).mockResolvedValue({ items: [socio(7)], total: 1 })

    const recarga = recargar()
    filtros.plan = 'ANUAL'
    await vaciar()
    primera.resolver({ items: [socio(1), socio(2)], total: 2 })
    await recarga
    await vaciar()

    expect(items.value.map((fila) => fila.socio.id)).toEqual([7])
  })
})
