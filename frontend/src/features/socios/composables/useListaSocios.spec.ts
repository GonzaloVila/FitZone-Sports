import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, type EffectScope } from 'vue'

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  obtenerMembresia: vi.fn(),
  modificarMembresia: vi.fn(),
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ socios: mocks }),
}))

import { ErrorApi } from '@/compartido/http/errores'
import { useAvisosFz } from '@/ui'
import type { Membresia, Socio } from '../services/servicioSocios'
import type { FilaSocio } from '../tipos'
import { useListaSocios } from './useListaSocios'

const socio = (id: number): Socio => ({
  id,
  usuarioId: id + 100,
  sedeOrigenId: 1,
  fechaAlta: '2026-01-01T00:00:00-03:00',
  nombre: `Socio ${id}`,
  email: `socio${id}@fitzone.com`,
})

const membresia = (renuevaAutomatica = false): Membresia => ({
  id: 1,
  plan: 'MENSUAL',
  estado: 'ACTIVA',
  fechaInicio: '2026-01-01T00:00:00-03:00',
  fechaFin: '2026-02-01T00:00:00-03:00',
  renuevaAutomatica,
})

// Promesa que se resuelve o rechaza a mano, para controlar el orden de las respuestas.
function diferida<T>() {
  let resolver!: (valor: T) => void
  let rechazar!: (motivo: unknown) => void
  const promesa = new Promise<T>((resolve, reject) => {
    resolver = resolve
    rechazar = reject
  })
  return { promesa, resolver, rechazar }
}

// Con timers falsos las promesas ya resueltas se vacían avanzando el reloj de a poco.
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

const avisos = useAvisosFz()

describe('useListaSocios', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    avisos.cerrarTodos()
    mocks.listar.mockReset().mockResolvedValue({ items: [socio(1), socio(2)], total: 2 })
    mocks.obtenerMembresia.mockReset().mockResolvedValue(membresia())
    mocks.modificarMembresia.mockReset().mockResolvedValue(membresia(true))
  })

  afterEach(() => {
    scope?.stop()
    vi.useRealTimers()
  })

  it('carga la primera página y pide la membresía de cada fila', async () => {
    const { items, total, cargando, porPagina } = await armar()

    expect(porPagina).toBe(10)
    expect(mocks.listar).toHaveBeenCalledWith(
      { nombre: undefined, estadoMembresia: undefined, plan: undefined, sedeOrigenId: undefined },
      1,
      10,
      expect.any(AbortSignal),
    )
    expect(total.value).toBe(2)
    expect(cargando.value).toBe(false)
    expect(items.value.map((fila) => fila.socio.id)).toEqual([1, 2])
    expect(items.value.every((fila) => fila.membresia.situacion === 'disponible')).toBe(true)
  })

  it('si la membresía de una fila falla, solo esa queda no disponible', async () => {
    mocks.obtenerMembresia.mockImplementation((id: number) =>
      id === 2 ? Promise.reject(new Error('falla')) : Promise.resolve(membresia()),
    )

    const { items } = await armar()

    expect(items.value.map((fila) => fila.membresia.situacion)).toEqual(['disponible', 'no-disponible'])
  })

  it('pide como máximo 4 membresías en paralelo', async () => {
    mocks.listar.mockResolvedValue({ items: Array.from({ length: 10 }, (_, i) => socio(i + 1)), total: 10 })
    let enCurso = 0
    let maximo = 0
    mocks.obtenerMembresia.mockImplementation(async () => {
      enCurso++
      maximo = Math.max(maximo, enCurso)
      await new Promise((resolve) => setTimeout(resolve, 10))
      enCurso--
      return membresia()
    })

    const { items } = await armar()
    await vi.advanceTimersByTimeAsync(100)
    await vaciar()

    expect(maximo).toBe(4)
    expect(items.value.every((fila) => fila.membresia.situacion === 'disponible')).toBe(true)
  })

  it('cambiar un filtro vuelve a la página 1 y consulta con el filtro', async () => {
    mocks.listar.mockResolvedValue({ items: [socio(1)], total: 25 })
    const { filtros, pagina } = await armar()
    pagina.value = 2
    await vaciar()
    mocks.listar.mockClear()

    filtros.estado = 'ACTIVA'
    await vaciar()

    expect(pagina.value).toBe(1)
    expect(mocks.listar).toHaveBeenLastCalledWith(expect.objectContaining({ estadoMembresia: 'ACTIVA' }), 1, 10, expect.any(AbortSignal))
  })

  it('un valor de filtro desconocido equivale a "todos"', async () => {
    const { filtros } = await armar()
    mocks.listar.mockClear()

    filtros.plan = 'DIARIO'
    await vaciar()

    expect(mocks.listar).toHaveBeenLastCalledWith(expect.objectContaining({ plan: undefined }), 1, 10, expect.any(AbortSignal))
  })

  it('el nombre se aplica con debounce y recortado', async () => {
    const { filtros } = await armar()
    mocks.listar.mockClear()

    filtros.nombre = '  ana  '
    await nextTick()
    await vi.advanceTimersByTimeAsync(299)
    expect(mocks.listar).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await vaciar()
    expect(mocks.listar).toHaveBeenCalledTimes(1)
    expect(mocks.listar).toHaveBeenLastCalledWith(expect.objectContaining({ nombre: 'ana' }), 1, 10, expect.any(AbortSignal))
  })

  it('descarta la respuesta de una consulta vieja', async () => {
    const primera = diferida<{ items: Socio[]; total: number }>()
    const segunda = diferida<{ items: Socio[]; total: number }>()
    mocks.listar.mockReset().mockReturnValueOnce(primera.promesa).mockReturnValueOnce(segunda.promesa)

    const { filtros, items, total } = await armar()
    filtros.estado = 'ACTIVA'
    await vaciar()

    segunda.resolver({ items: [socio(2)], total: 1 })
    await vaciar()
    primera.resolver({ items: [socio(1), socio(3)], total: 2 })
    await vaciar()

    expect(items.value.map((fila) => fila.socio.id)).toEqual([2])
    expect(total.value).toBe(1)
  })

  it('si la página quedó fuera de rango vuelve a la última', async () => {
    mocks.listar.mockImplementation(async (_filtros: unknown, pagina: number) =>
      pagina > 2 ? { items: [], total: 15 } : { items: [socio(1)], total: 15 },
    )
    const { pagina, totalPaginas } = await armar()

    pagina.value = 3
    await vaciar()

    expect(totalPaginas.value).toBe(2)
    expect(pagina.value).toBe(2)
  })

  it('hayFiltrosActivos y limpiarFiltros', async () => {
    const { filtros, hayFiltrosActivos, limpiarFiltros } = await armar()
    expect(hayFiltrosActivos.value).toBe(false)

    filtros.nombre = '   '
    expect(hayFiltrosActivos.value).toBe(false)

    filtros.nombre = 'ana'
    expect(hayFiltrosActivos.value).toBe(true)
    filtros.nombre = ''
    filtros.sede = '3'
    expect(hayFiltrosActivos.value).toBe(true)

    filtros.estado = 'VENCIDA'
    filtros.plan = 'ANUAL'
    await vaciar()
    mocks.listar.mockClear()
    limpiarFiltros()
    await vaciar()

    expect(filtros).toEqual({ nombre: '', estado: '', plan: '', sede: '' })
    expect(hayFiltrosActivos.value).toBe(false)
    expect(mocks.listar).toHaveBeenLastCalledWith(
      { nombre: undefined, estadoMembresia: undefined, plan: undefined, sedeOrigenId: undefined },
      1,
      10,
      expect.any(AbortSignal),
    )
  })

  describe('alternarRenovacion', () => {
    const renovacionDe = (fila?: FilaSocio) =>
      fila?.membresia.situacion === 'disponible' ? fila.membresia.membresia.renuevaAutomatica : undefined

    it('guarda el valor contrario y reemplaza la fila con la respuesta del servidor', async () => {
      mocks.modificarMembresia.mockResolvedValue({ ...membresia(true), plan: 'ANUAL' })
      const { items, alternarRenovacion, guardandoRenovacion } = await armar()

      await alternarRenovacion(1)
      await vaciar()

      expect(mocks.modificarMembresia).toHaveBeenCalledWith(1, { renuevaAutomatica: true })
      const fila = items.value[0]
      expect(fila?.membresia).toEqual({ situacion: 'disponible', membresia: { ...membresia(true), plan: 'ANUAL' } })
      expect(renovacionDe(items.value[1])).toBe(false)
      expect(guardandoRenovacion.size).toBe(0)
      expect(avisos.avisos.value).toHaveLength(0)
    })

    it('si la renovación estaba activa, manda false', async () => {
      mocks.obtenerMembresia.mockResolvedValue(membresia(true))
      mocks.modificarMembresia.mockResolvedValue(membresia(false))
      const { items, alternarRenovacion } = await armar()

      await alternarRenovacion(2)

      expect(mocks.modificarMembresia).toHaveBeenCalledWith(2, { renuevaAutomatica: false })
      expect(renovacionDe(items.value[1])).toBe(false)
    })

    it('marca al socio como guardando mientras dura y lo libera al terminar', async () => {
      const respuesta = diferida<Membresia>()
      mocks.modificarMembresia.mockReturnValue(respuesta.promesa)
      const { alternarRenovacion, guardandoRenovacion } = await armar()

      const guardado = alternarRenovacion(1)
      expect(guardandoRenovacion.has(1)).toBe(true)
      expect(guardandoRenovacion.has(2)).toBe(false)

      respuesta.resolver(membresia(true))
      await guardado
      expect(guardandoRenovacion.has(1)).toBe(false)
    })

    it('si falla no cambia la fila, avisa el error y libera el id', async () => {
      mocks.modificarMembresia.mockRejectedValue(new ErrorApi(409, 'La membresía está suspendida.'))
      const { items, alternarRenovacion, guardandoRenovacion } = await armar()

      await alternarRenovacion(1)

      expect(renovacionDe(items.value[0])).toBe(false)
      expect(guardandoRenovacion.has(1)).toBe(false)
      expect(avisos.avisos.value.map((aviso) => [aviso.tipo, aviso.titulo])).toEqual([
        ['error', 'La membresía está suspendida.'],
      ])
    })

    it('si falla sin mensaje del servidor usa el texto por defecto', async () => {
      mocks.modificarMembresia.mockRejectedValue(new TypeError('red'))
      const { alternarRenovacion } = await armar()

      await alternarRenovacion(1)

      expect(avisos.avisos.value.map((aviso) => aviso.titulo)).toEqual(['No se pudo cambiar la renovación automática.'])
    })

    it('ignora un segundo toque mientras el primero guarda', async () => {
      const respuesta = diferida<Membresia>()
      mocks.modificarMembresia.mockReturnValue(respuesta.promesa)
      const { alternarRenovacion } = await armar()

      const primero = alternarRenovacion(1)
      await alternarRenovacion(1)
      respuesta.resolver(membresia(true))
      await primero

      expect(mocks.modificarMembresia).toHaveBeenCalledTimes(1)
    })

    it('guarda a dos socios distintos a la vez', async () => {
      const { alternarRenovacion } = await armar()

      await Promise.all([alternarRenovacion(1), alternarRenovacion(2)])

      expect(mocks.modificarMembresia).toHaveBeenCalledTimes(2)
    })

    it('si la fila ya no está al volver la respuesta, la ignora', async () => {
      const respuesta = diferida<Membresia>()
      mocks.modificarMembresia.mockReturnValue(respuesta.promesa)
      const { items, filtros, alternarRenovacion, guardandoRenovacion } = await armar()

      const guardado = alternarRenovacion(1)
      mocks.listar.mockResolvedValue({ items: [socio(5)], total: 1 })
      filtros.estado = 'VENCIDA'
      await vaciar()
      respuesta.resolver(membresia(true))
      await guardado
      await vaciar()

      expect(items.value.map((fila) => fila.socio.id)).toEqual([5])
      expect(renovacionDe(items.value[0])).toBe(false)
      expect(guardandoRenovacion.size).toBe(0)
    })

    it('si la consulta cambió, tampoco avisa un error viejo', async () => {
      const respuesta = diferida<Membresia>()
      mocks.modificarMembresia.mockReturnValue(respuesta.promesa)
      const { filtros, alternarRenovacion } = await armar()

      const guardado = alternarRenovacion(1)
      filtros.plan = 'ANUAL'
      await vaciar()
      respuesta.rechazar(new ErrorApi(500, 'Falló'))
      await guardado

      expect(avisos.avisos.value).toHaveLength(0)
    })

    it('no hace nada si la membresía de la fila no está disponible', async () => {
      mocks.obtenerMembresia.mockRejectedValue(new Error('falla'))
      const { alternarRenovacion, guardandoRenovacion } = await armar()

      await alternarRenovacion(1)

      expect(mocks.modificarMembresia).not.toHaveBeenCalled()
      expect(guardandoRenovacion.size).toBe(0)
    })

    it('no hace nada si la membresía todavía está cargando', async () => {
      mocks.obtenerMembresia.mockReturnValue(new Promise(() => {}))
      const { alternarRenovacion } = await armar()

      await alternarRenovacion(1)

      expect(mocks.modificarMembresia).not.toHaveBeenCalled()
    })

    it('no hace nada con un socio que no está en la lista', async () => {
      const { alternarRenovacion } = await armar()

      await alternarRenovacion(99)

      expect(mocks.modificarMembresia).not.toHaveBeenCalled()
    })
  })
})
