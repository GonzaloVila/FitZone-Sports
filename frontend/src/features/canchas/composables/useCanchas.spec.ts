import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  route: { name: 'canchas', query: {} as Record<string, unknown> },
  replace: vi.fn(),
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ canchas: { listar: mocks.listar } }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace }),
}))

import { useCanchas } from './useCanchas'

function armar(sedePorDefecto: Parameters<typeof useCanchas>[0]) {
  const scope = effectScope()
  const estado = scope.run(() => useCanchas(sedePorDefecto))!
  return { ...estado, detener: () => scope.stop() }
}

const ultimoReplace = () => mocks.replace.mock.calls.at(-1)?.[0]

describe('useCanchas', () => {
  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue({ items: [], total: 0 })
    mocks.route = reactive({ name: 'canchas', query: {} as Record<string, unknown> })
    // El router de verdad deja la dirección nueva en la ruta: acá se imita.
    mocks.replace.mockReset().mockImplementation(async ({ query }: { query: Record<string, unknown> }) => {
      mocks.route.query = query
    })
  })

  it('arranca en la sede por defecto, sin escribirla en la dirección', async () => {
    const { filtros, detener } = armar(() => 4)
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    expect(filtros.sede).toBe('4')
    expect(mocks.listar).toHaveBeenCalledWith(4, { estado: undefined }, 1, 12, expect.anything())
    expect(mocks.replace).not.toHaveBeenCalled()
    detener()
  })

  it('sin sede todavía no consulta; cuando llega la sede por defecto consulta una vez', async () => {
    const porDefecto = ref<number | null>(null)
    const { filtros, detener } = armar(porDefecto)
    await nextTick()

    expect(filtros.sede).toBe('')
    expect(mocks.listar).not.toHaveBeenCalled()

    porDefecto.value = 7
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    expect(mocks.listar).toHaveBeenCalledWith(7, { estado: undefined }, 1, 12, expect.anything())
    detener()
  })

  it('arranca con lo que dice la dirección y descarta lo inválido', async () => {
    mocks.route.query = { sede: '3', estado: 'EN_MANTENIMIENTO', pagina: '2' }
    const { filtros, pagina, detener } = armar(() => 4)
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    expect(filtros.sede).toBe('3')
    expect(filtros.estado).toBe('EN_MANTENIMIENTO')
    expect(pagina.value).toBe(2)
    expect(mocks.listar).toHaveBeenCalledWith(3, { estado: 'EN_MANTENIMIENTO' }, 2, 12, expect.anything())
    detener()

    mocks.listar.mockClear()
    mocks.route.query = { sede: 'xx', estado: 'raro', pagina: '-4', otra: 'cosa' }
    const otra = armar(() => 4)
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))
    expect(otra.filtros.sede).toBe('4')
    expect(otra.filtros.estado).toBe('')
    expect(otra.pagina.value).toBe(1)
    otra.detener()
  })

  it('elegir una sede reemplaza la dirección, vuelve a la página 1 y conserva la vista', async () => {
    mocks.route.query = { vista: 'canchas', pagina: '3' }
    const { filtros, detener } = armar(() => 4)
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    filtros.sede = '5'

    expect(ultimoReplace()).toEqual({ query: { vista: 'canchas', sede: '5' } })
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))
    expect(mocks.listar).toHaveBeenLastCalledWith(5, { estado: undefined }, 1, 12, expect.anything())
    detener()
  })

  it('elegir un estado reemplaza la dirección y vuelve a consultar', async () => {
    const { filtros, detener } = armar(() => 4)
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    filtros.estado = 'OPERATIVA'

    expect(ultimoReplace()).toEqual({ query: { estado: 'OPERATIVA' } })
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))
    expect(mocks.listar).toHaveBeenLastCalledWith(4, { estado: 'OPERATIVA' }, 1, 12, expect.anything())
    detener()
  })

  it('cambiar de página reemplaza la dirección y consulta esa página', async () => {
    mocks.listar.mockResolvedValue({ items: [], total: 40 })
    const { pagina, detener } = armar(() => 4)
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    pagina.value = 3

    expect(ultimoReplace()).toEqual({ query: { pagina: '3' } })
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))
    expect(mocks.listar.mock.calls.at(-1)?.[2]).toBe(3)
    detener()
  })

  it('si la dirección cambia por otro lado (Atrás, un enlace) la lista la sigue', async () => {
    const { filtros, detener } = armar(() => 4)
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    mocks.route.query = { estado: 'OPERATIVA' }
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))

    expect(filtros.estado).toBe('OPERATIVA')
    detener()
  })

  it('al salir hacia otra ruta (la grilla) no reacciona a los parámetros de esa ruta', async () => {
    mocks.route.query = { estado: 'OPERATIVA' }
    const { filtros, detener } = armar(() => 4)
    await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

    mocks.route.name = 'cancha-turnos'
    mocks.route.query = { desde: 'canchas' }
    await nextTick()

    expect(filtros.estado).toBe('OPERATIVA')
    expect(mocks.listar).toHaveBeenCalledTimes(1)
    expect(mocks.replace).not.toHaveBeenCalled()
    detener()
  })

  it('ofrece los parámetros con que la grilla reconstruye esta lista', () => {
    mocks.route.query = { sede: '2', estado: 'OPERATIVA', pagina: '2' }
    const { parametrosDetalle, detener } = armar(() => 4)

    expect(parametrosDetalle.value).toEqual({ desde: 'canchas', sede: '2', estado: 'OPERATIVA', pagina: '2' })
    detener()
  })

  it('una página fuera de rango vuelve a la última', async () => {
    mocks.route.query = { pagina: '9' }
    mocks.listar.mockResolvedValue({ items: [], total: 25 })
    const { detener } = armar(() => 4)

    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalled())

    expect(ultimoReplace()).toEqual({ query: { pagina: '3' } })
    detener()
  })

  it('si falla la consulta deja el error y vacía la lista', async () => {
    mocks.listar.mockRejectedValue(new Error('boom'))
    const { error, items, detener } = armar(() => 4)

    await vi.waitFor(() => expect(error.value).toBe('No se pudieron cargar las canchas.'))

    expect(items.value).toEqual([])
    detener()
  })
})
