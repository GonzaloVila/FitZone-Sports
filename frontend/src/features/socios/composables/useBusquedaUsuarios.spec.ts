import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'

const mocks = vi.hoisted(() => ({ listar: vi.fn() }))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ usuarios: mocks }),
}))

import { ErrorApi } from '@/compartido/http/errores'
import type { Usuario } from '@/features/usuarios/services/servicioUsuarios'
import { ESPERA_BUSQUEDA_MS, useBusquedaUsuarios } from './useBusquedaUsuarios'

const usuario = (id: number, nombre = `Usuario ${id}`): Usuario => ({
  id,
  rol: 'EXTERNO',
  dni: String(30000000 + id),
  nombre,
  email: `usuario${id}@fitzone.com`,
})

function diferida<T>() {
  let resolver!: (valor: T) => void
  let rechazar!: (error: unknown) => void
  const promesa = new Promise<T>((resolve, reject) => {
    resolver = resolve
    rechazar = reject
  })
  return { promesa, resolver, rechazar }
}

let scope: EffectScope

async function vaciar() {
  for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(0)
}

async function armar() {
  scope = effectScope()
  return scope.run(() => useBusquedaUsuarios())!
}

// Escribe y espera lo que corresponde a la espera de 300 ms.
async function escribir(busqueda: ReturnType<typeof useBusquedaUsuarios>, texto: string) {
  busqueda.busqueda.value = texto
  await vaciar()
  await vi.advanceTimersByTimeAsync(ESPERA_BUSQUEDA_MS)
  await vaciar()
}

describe('useBusquedaUsuarios', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.listar.mockReset().mockResolvedValue({ items: [usuario(1)], total: 1 })
  })

  afterEach(() => {
    scope?.stop()
    vi.useRealTimers()
  })

  it('espera 300 ms después de la última tecla y busca una sola vez', async () => {
    const busqueda = await armar()

    busqueda.busqueda.value = 'an'
    await vaciar()
    await vi.advanceTimersByTimeAsync(200)
    busqueda.busqueda.value = 'ana'
    await vaciar()
    await vi.advanceTimersByTimeAsync(200)
    expect(mocks.listar).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)
    await vaciar()

    expect(mocks.listar).toHaveBeenCalledTimes(1)
    expect(mocks.listar).toHaveBeenCalledWith({ rol: 'EXTERNO', nombre: 'ana' }, 1, 10, expect.anything())
    expect(busqueda.resultados.value).toEqual([usuario(1)])
    expect(busqueda.busquedaHecha.value).toBe(true)
  })

  it('con menos de 2 caracteres no busca y limpia los resultados', async () => {
    const busqueda = await armar()
    await escribir(busqueda, 'ana')
    expect(busqueda.resultados.value).toHaveLength(1)
    mocks.listar.mockClear()

    await escribir(busqueda, 'a')

    expect(mocks.listar).not.toHaveBeenCalled()
    expect(busqueda.resultados.value).toEqual([])
    expect(busqueda.busquedaHecha.value).toBe(false)
  })

  it('el texto se recorta, y con "@" busca por correo exacto', async () => {
    const busqueda = await armar()

    await escribir(busqueda, '  ana@fitzone.com  ')

    expect(mocks.listar).toHaveBeenCalledWith({ rol: 'EXTERNO', email: 'ana@fitzone.com' }, 1, 10, expect.anything())
  })

  it('solo pide usuarios EXTERNO', async () => {
    const busqueda = await armar()

    await escribir(busqueda, 'ana')

    expect(mocks.listar.mock.calls[0]![0]).toMatchObject({ rol: 'EXTERNO' })
  })

  it('avisa si hay más resultados que los mostrados', async () => {
    mocks.listar.mockResolvedValue({ items: [usuario(1), usuario(2)], total: 25 })
    const busqueda = await armar()

    await escribir(busqueda, 'ana')

    expect(busqueda.hayMasResultados.value).toBe(true)
  })

  it('sin resultados: busquedaHecha con la lista vacía (para decir "no se encontraron")', async () => {
    mocks.listar.mockResolvedValue({ items: [], total: 0 })
    const busqueda = await armar()

    await escribir(busqueda, 'zzz')

    expect(busqueda.resultados.value).toEqual([])
    expect(busqueda.busquedaHecha.value).toBe(true)
    expect(busqueda.hayMasResultados.value).toBe(false)
  })

  it('mientras busca queda en curso', async () => {
    const respuesta = diferida<{ items: Usuario[]; total: number }>()
    mocks.listar.mockReturnValue(respuesta.promesa)
    const busqueda = await armar()

    await escribir(busqueda, 'ana')
    expect(busqueda.buscando.value).toBe(true)

    respuesta.resolver({ items: [], total: 0 })
    await vaciar()
    expect(busqueda.buscando.value).toBe(false)
  })

  it('descarta la respuesta de una búsqueda vieja que llega tarde', async () => {
    const vieja = diferida<{ items: Usuario[]; total: number }>()
    const nueva = diferida<{ items: Usuario[]; total: number }>()
    mocks.listar.mockReturnValueOnce(vieja.promesa).mockReturnValueOnce(nueva.promesa)
    const busqueda = await armar()

    await escribir(busqueda, 'ana')
    await escribir(busqueda, 'ana perez')
    nueva.resolver({ items: [usuario(2, 'Ana Pérez')], total: 1 })
    await vaciar()
    vieja.resolver({ items: [usuario(1, 'Ana Gómez'), usuario(3, 'Ana López')], total: 2 })
    await vaciar()

    expect(busqueda.resultados.value.map((u) => u.nombre)).toEqual(['Ana Pérez'])
    expect(busqueda.buscando.value).toBe(false)
  })

  it('cancela con AbortController la búsqueda anterior al lanzar otra', async () => {
    const senales: AbortSignal[] = []
    mocks.listar.mockImplementation((_filtros: unknown, _p: number, _pp: number, senal: AbortSignal) => {
      senales.push(senal)
      return new Promise(() => {})
    })
    const busqueda = await armar()

    await escribir(busqueda, 'ana')
    await escribir(busqueda, 'ana perez')

    expect(senales.map((senal) => senal.aborted)).toEqual([true, false])
  })

  it('un error de la búsqueda deja el mensaje y la lista vacía; una nueva búsqueda lo borra', async () => {
    mocks.listar.mockRejectedValueOnce(new ErrorApi(500, 'Falló el servidor'))
    const busqueda = await armar()

    await escribir(busqueda, 'ana')
    expect(busqueda.errorBusqueda.value).toBe('Falló el servidor')
    expect(busqueda.resultados.value).toEqual([])

    await escribir(busqueda, 'ana p')
    expect(busqueda.errorBusqueda.value).toBeNull()
    expect(busqueda.resultados.value).toHaveLength(1)
  })

  it('un error que no es del contrato usa el mensaje por defecto', async () => {
    mocks.listar.mockRejectedValueOnce(new Error('caída'))
    const busqueda = await armar()

    await escribir(busqueda, 'ana')

    expect(busqueda.errorBusqueda.value).toBe('No se pudo buscar usuarios.')
  })

  it('reiniciar vuelve al estado inicial y descarta una respuesta que todavía estaba en camino', async () => {
    const respuesta = diferida<{ items: Usuario[]; total: number }>()
    mocks.listar.mockReturnValue(respuesta.promesa)
    const busqueda = await armar()
    await escribir(busqueda, 'ana')

    busqueda.reiniciar()
    respuesta.resolver({ items: [usuario(1)], total: 1 })
    await vaciar()
    await vi.advanceTimersByTimeAsync(ESPERA_BUSQUEDA_MS)
    await vaciar()

    expect(busqueda.busqueda.value).toBe('')
    expect(busqueda.resultados.value).toEqual([])
    expect(busqueda.busquedaHecha.value).toBe(false)
    expect(busqueda.buscando.value).toBe(false)
    expect(mocks.listar).toHaveBeenCalledTimes(1)
  })

  it('al salir del scope no dispara una búsqueda pendiente', async () => {
    const busqueda = await armar()
    busqueda.busqueda.value = 'ana'
    await vaciar()

    scope.stop()
    await vi.advanceTimersByTimeAsync(ESPERA_BUSQUEDA_MS * 2)

    expect(mocks.listar).not.toHaveBeenCalled()
  })
})
