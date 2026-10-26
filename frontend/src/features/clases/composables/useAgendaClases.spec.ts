import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  sedeId: { value: null as number | null },
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ clases: { listar: mocks.listar } }),
}))

vi.mock('@/features/sesion/composables/useUsuarioSesion', () => ({
  useUsuarioSesion: () => ({ sedeId: mocks.sedeId }),
}))

import { useAgendaClases } from './useAgendaClases'

function armar(sedeInicial?: Parameters<typeof useAgendaClases>[0]) {
  const scope = effectScope()
  const estado = scope.run(() => useAgendaClases(sedeInicial))!
  return { ...estado, detener: () => scope.stop() }
}

const sedeDeLaUltimaConsulta = () => mocks.listar.mock.calls.at(-1)?.[0].sedeId

describe('useAgendaClases: sede con la que arranca el filtro', () => {
  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue({ items: [], total: 0 })
    mocks.sedeId.value = null
  })

  it('sin sede fija ni sede inicial muestra todas las sedes', async () => {
    const { filtros, detener } = armar()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    expect(filtros.sede).toBe('')
    expect(sedeDeLaUltimaConsulta()).toBeUndefined()
    detener()
  })

  it('con una sede inicial disponible arranca filtrando por ella, en una sola consulta', async () => {
    const { filtros, detener } = armar(() => 4)
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    expect(filtros.sede).toBe('4')
    expect(sedeDeLaUltimaConsulta()).toBe(4)
    detener()
  })

  it('si la sede inicial llega después (cargan las sedes) filtra por ella y vuelve a consultar', async () => {
    const inicial = ref<number | null>(null)
    const { filtros, detener } = armar(inicial)
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    inicial.value = 7
    await nextTick()
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))

    expect(filtros.sede).toBe('7')
    expect(sedeDeLaUltimaConsulta()).toBe(7)
    detener()
  })

  it('la sede inicial se aplica una sola vez: si después se elige "todas", no vuelve sola', async () => {
    const inicial = ref<number | null>(3)
    const { filtros, detener } = armar(inicial)
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    filtros.sede = ''
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))
    inicial.value = 5
    await nextTick()

    expect(filtros.sede).toBe('')
    expect(mocks.listar).toHaveBeenCalledTimes(2)
    detener()
  })

  it('el RECEPCION arranca en su sede aunque la sede inicial sea otra', async () => {
    mocks.sedeId.value = 2
    const { filtros, detener } = armar(() => 9)
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    expect(filtros.sede).toBe('2')
    expect(sedeDeLaUltimaConsulta()).toBe(2)
    detener()
  })
})
