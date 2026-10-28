import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

const mocks = vi.hoisted(() => ({ listar: vi.fn() }))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ pagos: { listar: mocks.listar } }),
}))

import { useListaPagos } from './useListaPagos'

async function armar(opciones?: Parameters<typeof useListaPagos>[0]) {
  const scope = effectScope()
  const estado = scope.run(() => useListaPagos(opciones))!
  await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalled())
  return { ...estado, detener: () => scope.stop() }
}

describe('useListaPagos', () => {
  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue({ items: [], total: 0 })
  })

  it('el estado arranca en "TODOS" y se manda explícito a la API', async () => {
    const { filtros, detener } = await armar()

    expect(filtros.estado).toBe('TODOS')
    expect(mocks.listar).toHaveBeenCalledWith(
      { estado: 'TODOS', tipo: undefined, desde: undefined, hasta: undefined },
      1,
      10,
      expect.any(AbortSignal),
    )
    detener()
  })

  it('manda el estado elegido y vuelve a la página 1', async () => {
    const { filtros, pagina, detener } = await armar()
    pagina.value = 2
    await nextTick()
    mocks.listar.mockClear()

    filtros.estado = 'RECHAZADO'
    await nextTick()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalled())

    expect(pagina.value).toBe(1)
    expect(mocks.listar.mock.calls[0]?.[0]).toMatchObject({ estado: 'RECHAZADO' })
    detener()
  })

  it('con desde posterior a hasta no consulta y marca el filtro inválido', async () => {
    const { filtros, filtroInvalido, detener } = await armar()
    mocks.listar.mockClear()

    filtros.desde = '2026-10-10'
    filtros.hasta = '2026-10-01'
    await nextTick()

    expect(filtroInvalido.value).toBe(true)
    expect(mocks.listar).not.toHaveBeenCalled()
    detener()
  })

  it('hayFiltrosActivos cuenta usuario, estado (si no es TODOS), concepto, desde y hasta', async () => {
    const { filtros, hayFiltrosActivos, detener } = await armar()
    expect(hayFiltrosActivos.value).toBe(false)

    const elegido = { usuarioId: '7', estado: 'RECHAZADO', tipo: 'MEMBRESIA', desde: '2026-10-01', hasta: '2026-10-01' }
    const inicial = { usuarioId: '', estado: 'TODOS', tipo: '', desde: '', hasta: '' }
    for (const campo of ['usuarioId', 'estado', 'tipo', 'desde', 'hasta'] as const) {
      filtros[campo] = elegido[campo]
      expect(hayFiltrosActivos.value).toBe(true)
      filtros[campo] = inicial[campo]
      expect(hayFiltrosActivos.value).toBe(false)
    }
    detener()
  })

  it('elegir "Aprobado" cuenta como filtro activo: ya no es el valor por defecto', async () => {
    const { filtros, hayFiltrosActivos, detener } = await armar()

    filtros.estado = 'APROBADO'

    expect(hayFiltrosActivos.value).toBe(true)
    detener()
  })

  it('limpiarFiltros vuelve el estado a TODOS y los demás filtros a vacío, y consulta de nuevo', async () => {
    const { filtros, limpiarFiltros, hayFiltrosActivos, detener } = await armar()
    filtros.estado = 'RECHAZADO'
    filtros.tipo = 'MEMBRESIA'
    filtros.desde = '2026-10-01'
    filtros.hasta = '2026-10-31'
    await nextTick()
    mocks.listar.mockClear()

    limpiarFiltros()
    await nextTick()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalled())

    expect({ ...filtros }).toEqual({ usuarioId: '', estado: 'TODOS', tipo: '', desde: '', hasta: '' })
    expect(mocks.listar.mock.calls[0]?.[0]).toMatchObject({ estado: 'TODOS' })
    expect(hayFiltrosActivos.value).toBe(false)
    detener()
  })

  it('sin usuarioId fijo no manda usuarioId', async () => {
    const { detener } = await armar()

    expect(mocks.listar.mock.calls[0]?.[0]).not.toHaveProperty('usuarioId')
    detener()
  })

  it('con usuarioId fijo lo manda en la consulta y lo sigue mandando después de limpiarFiltros', async () => {
    const { filtros, limpiarFiltros, hayFiltrosActivos, detener } = await armar({ usuarioId: 7 })
    expect(mocks.listar.mock.calls[0]?.[0]).toMatchObject({ usuarioId: 7 })
    expect(hayFiltrosActivos.value).toBe(false)

    filtros.estado = 'RECHAZADO'
    await nextTick()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))
    mocks.listar.mockClear()

    limpiarFiltros()
    await nextTick()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalled())

    expect(mocks.listar.mock.calls[0]?.[0]).toMatchObject({ usuarioId: 7, estado: 'TODOS' })
    detener()
  })

  // Un campo con type="number" entrega un NÚMERO en runtime aunque el modelo se declare como texto (v-model lo convierte).
  describe('campo "ID de usuario" con un valor numérico (type="number")', () => {
    const comoNumero = (valor: number) => valor as unknown as string

    it('hayFiltrosActivos pasa a true de inmediato, sin esperar', async () => {
      const { filtros, hayFiltrosActivos, detener } = await armar()

      filtros.usuarioId = comoNumero(2)

      expect(hayFiltrosActivos.value).toBe(true)
      detener()
    })

    it('tras la espera manda usuarioId como número a la consulta', async () => {
      const { filtros, detener } = await armar()
      mocks.listar.mockClear()

      filtros.usuarioId = comoNumero(2)
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

      expect(mocks.listar.mock.calls[0]?.[0]).toMatchObject({ usuarioId: 2 })
      detener()
    })

    it('limpiarFiltros lo vacía y la consulta vuelve a hacerse sin usuarioId', async () => {
      const { filtros, limpiarFiltros, hayFiltrosActivos, detener } = await armar()
      filtros.usuarioId = comoNumero(2)
      await vi.waitFor(() => expect(mocks.listar.mock.calls.at(-1)?.[0]).toMatchObject({ usuarioId: 2 }))
      mocks.listar.mockClear()

      limpiarFiltros()
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalled())

      expect(filtros.usuarioId).toBe('')
      expect(hayFiltrosActivos.value).toBe(false)
      expect(mocks.listar.mock.calls[0]?.[0]).not.toHaveProperty('usuarioId')
      detener()
    })

    it('un campo vaciado (que puede quedar null) no rompe nada ni se manda', async () => {
      const { filtros, hayFiltrosActivos, detener } = await armar()
      mocks.listar.mockClear()

      filtros.usuarioId = null as unknown as string
      await vi.waitFor(() => expect(mocks.listar).not.toHaveBeenCalled())

      expect(hayFiltrosActivos.value).toBe(false)
      detener()
    })
  })

  describe('campo "ID de usuario"', () => {
    it('manda el texto como número entero positivo, esperando un instante a que termine de escribir', async () => {
      const { filtros, pagina, detener } = await armar()
      mocks.listar.mockClear()

      filtros.usuarioId = '1'
      filtros.usuarioId = '12'
      await nextTick()
      expect(mocks.listar).not.toHaveBeenCalled()

      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))
      expect(mocks.listar.mock.calls[0]?.[0]).toMatchObject({ usuarioId: 12 })
      expect(pagina.value).toBe(1)
      detener()
    })

    it('vacío o inválido no se manda', async () => {
      const { filtros, detener } = await armar()

      for (const invalido of ['abc', '0', '-3', '1.5', '1e3', '12abc']) {
        mocks.listar.mockClear()
        filtros.usuarioId = invalido
        await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))
        expect(mocks.listar.mock.calls[0]?.[0]).not.toHaveProperty('usuarioId')
        filtros.usuarioId = ''
        await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))
      }
      detener()
    })

    it('limpiarFiltros lo vacía y consulta sin usuarioId enseguida', async () => {
      const { filtros, limpiarFiltros, hayFiltrosActivos, detener } = await armar()
      filtros.usuarioId = '9'
      await vi.waitFor(() => expect(mocks.listar.mock.calls.at(-1)?.[0]).toMatchObject({ usuarioId: 9 }))
      mocks.listar.mockClear()

      limpiarFiltros()
      await nextTick()
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalled())

      expect(filtros.usuarioId).toBe('')
      expect(hayFiltrosActivos.value).toBe(false)
      expect(mocks.listar.mock.calls[0]?.[0]).not.toHaveProperty('usuarioId')
      detener()
    })

    it('el usuarioId fijo de Mis pagos manda sobre el campo', async () => {
      const { filtros, detener } = await armar({ usuarioId: 7 })
      mocks.listar.mockClear()

      filtros.usuarioId = '99'
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalled())

      expect(mocks.listar.mock.calls[0]?.[0]).toMatchObject({ usuarioId: 7 })
      detener()
    })
  })

  it('con una sesión sin usuario (null) no consulta nunca la lista de todos', async () => {
    const scope = effectScope()
    const estado = scope.run(() => useListaPagos({ usuarioId: null }))!
    await nextTick()
    estado.filtros.estado = 'RECHAZADO'
    await nextTick()

    expect(mocks.listar).not.toHaveBeenCalled()
    expect(estado.items.value).toEqual([])
    scope.stop()
  })
})
