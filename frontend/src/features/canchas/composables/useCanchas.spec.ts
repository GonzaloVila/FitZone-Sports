import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  buscar: vi.fn(),
  sedeId: { value: null as number | null },
  route: { name: 'canchas', query: {} as Record<string, unknown> },
  replace: vi.fn(),
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ canchas: { buscar: mocks.buscar } }),
}))

vi.mock('@/features/sesion/composables/useUsuarioSesion', () => ({
  useUsuarioSesion: () => ({ sedeId: mocks.sedeId }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace }),
}))

import { useCanchas } from './useCanchas'

function armar(sedePorDefecto?: Parameters<typeof useCanchas>[0]) {
  const scope = effectScope()
  const estado = scope.run(() => useCanchas(sedePorDefecto))!
  return { ...estado, detener: () => scope.stop() }
}

const ultimoReplace = () => mocks.replace.mock.calls.at(-1)?.[0]
const filtrosDe = (llamada: number) => mocks.buscar.mock.calls.at(llamada)?.[0]
const sinFiltros = { sedeId: undefined, tipo: undefined, estado: undefined }

describe('useCanchas', () => {
  beforeEach(() => {
    mocks.buscar.mockReset().mockResolvedValue({ items: [], total: 0 })
    mocks.sedeId.value = null
    mocks.route = reactive({ name: 'canchas', query: {} as Record<string, unknown> })
    // El router de verdad deja la dirección nueva en la ruta: acá se imita.
    mocks.replace.mockReset().mockImplementation(async ({ query }: { query: Record<string, unknown> }) => {
      mocks.route.query = query
    })
  })

  describe('sede con la que arranca el filtro', () => {
    it('sin sede fija ni por defecto muestra todas las sedes, con filtros y paginación en el servidor', async () => {
      const { filtros, detener } = armar()
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

      expect(filtros.sede).toBe('')
      expect(mocks.buscar).toHaveBeenCalledWith(sinFiltros, 1, 12, expect.anything())
      expect(mocks.replace).not.toHaveBeenCalled()
      detener()
    })

    it('con una sede por defecto arranca filtrando por ella, sin escribirla en la dirección', async () => {
      const { filtros, detener } = armar(() => 4)
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

      expect(filtros.sede).toBe('4')
      expect(filtrosDe(-1)).toEqual({ ...sinFiltros, sedeId: 4 })
      expect(mocks.replace).not.toHaveBeenCalled()
      detener()
    })

    it('si la sede por defecto llega después (cargan las sedes) filtra por ella y vuelve a consultar', async () => {
      const porDefecto = ref<number | null>(null)
      const { filtros, detener } = armar(porDefecto)
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

      porDefecto.value = 7
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(2))

      expect(filtros.sede).toBe('7')
      expect(filtrosDe(-1)).toEqual({ ...sinFiltros, sedeId: 7 })
      detener()
    })

    it('elegir "todas" queda en la dirección (sede=todas) y no vuelve sola a la sede por defecto', async () => {
      mocks.route.query = { sede: '3' }
      const { filtros, detener } = armar(() => 4)
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

      filtros.sede = ''

      expect(ultimoReplace()).toEqual({ query: { sede: 'todas' } })
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(2))
      expect(filtros.sede).toBe('')
      expect(filtrosDe(-1)).toEqual(sinFiltros)
      detener()
    })

    it('el RECEPCION con sede en el token ve siempre la suya, aunque la dirección pida otra', async () => {
      mocks.sedeId.value = 2
      mocks.route.query = { sede: '9' }
      const { filtros, detener } = armar(() => 4)
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

      expect(filtros.sede).toBe('2')
      expect(filtrosDe(-1)).toEqual({ ...sinFiltros, sedeId: 2 })
      detener()
    })
  })

  describe('filtros y página en la dirección', () => {
    it('arranca con lo que dice la dirección', async () => {
      mocks.route.query = { sede: '3', tipo: 'PADDLE', estado: 'EN_MANTENIMIENTO', pagina: '2' }
      const { filtros, pagina, detener } = armar()
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

      expect(filtros.sede).toBe('3')
      expect(filtros.tipo).toBe('PADDLE')
      expect(filtros.estado).toBe('EN_MANTENIMIENTO')
      expect(pagina.value).toBe(2)
      expect(mocks.buscar).toHaveBeenCalledWith(
        { sedeId: 3, tipo: 'PADDLE', estado: 'EN_MANTENIMIENTO' },
        2,
        12,
        expect.anything(),
      )
      detener()
    })

    it('un tipo desconocido (o cualquier valor inválido) se ignora y se consulta sin ese filtro', async () => {
      mocks.route.query = { sede: 'xx', tipo: 'TENIS', estado: 'raro', pagina: '-4', otra: 'cosa' }
      const { filtros, pagina, detener } = armar()
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

      expect(filtros.sede).toBe('')
      expect(filtros.tipo).toBe('')
      expect(filtros.estado).toBe('')
      expect(pagina.value).toBe(1)
      expect(mocks.buscar).toHaveBeenCalledWith(sinFiltros, 1, 12, expect.anything())
      detener()
    })

    it('elegir una sede reemplaza la dirección, vuelve a la página 1 y conserva la vista', async () => {
      mocks.route.query = { vista: 'canchas', pagina: '3' }
      const { filtros, detener } = armar()
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

      filtros.sede = '5'

      expect(ultimoReplace()).toEqual({ query: { vista: 'canchas', sede: '5' } })
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(2))
      expect(mocks.buscar).toHaveBeenLastCalledWith({ ...sinFiltros, sedeId: 5 }, 1, 12, expect.anything())
      detener()
    })

    it('elegir un deporte reemplaza la dirección (?tipo=), vuelve a la página 1 y consulta con ese tipo', async () => {
      mocks.route.query = { pagina: '3' }
      mocks.buscar.mockResolvedValue({ items: [], total: 60 })
      const { filtros, pagina, detener } = armar()
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))
      expect(pagina.value).toBe(3)

      filtros.tipo = 'FUTBOL5'

      expect(ultimoReplace()).toEqual({ query: { tipo: 'FUTBOL5' } })
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(2))
      expect(mocks.buscar).toHaveBeenLastCalledWith({ ...sinFiltros, tipo: 'FUTBOL5' }, 1, 12, expect.anything())
      expect(pagina.value).toBe(1)
      detener()
    })

    it('volver a "Todos los deportes" quita ?tipo= de la dirección y consulta sin tipo', async () => {
      mocks.route.query = { tipo: 'PADDLE' }
      const { filtros, detener } = armar()
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

      filtros.tipo = ''

      expect(ultimoReplace()).toEqual({ query: {} })
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(2))
      expect(mocks.buscar).toHaveBeenLastCalledWith(sinFiltros, 1, 12, expect.anything())
      detener()
    })

    it('elegir un estado reemplaza la dirección y vuelve a consultar', async () => {
      const { filtros, detener } = armar()
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

      filtros.estado = 'OPERATIVA'

      expect(ultimoReplace()).toEqual({ query: { estado: 'OPERATIVA' } })
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(2))
      expect(mocks.buscar).toHaveBeenLastCalledWith({ ...sinFiltros, estado: 'OPERATIVA' }, 1, 12, expect.anything())
      detener()
    })

    it('los filtros se combinan en una sola consulta al servidor', async () => {
      mocks.route.query = { sede: '2', tipo: 'PADDLE' }
      const { filtros, detener } = armar()
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

      filtros.estado = 'EN_MANTENIMIENTO'

      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(2))
      expect(mocks.buscar).toHaveBeenLastCalledWith(
        { sedeId: 2, tipo: 'PADDLE', estado: 'EN_MANTENIMIENTO' },
        1,
        12,
        expect.anything(),
      )
      detener()
    })

    it('cambiar de página reemplaza la dirección y consulta esa página', async () => {
      mocks.buscar.mockResolvedValue({ items: [], total: 40 })
      const { pagina, detener } = armar()
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

      pagina.value = 3

      expect(ultimoReplace()).toEqual({ query: { pagina: '3' } })
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(2))
      expect(mocks.buscar.mock.calls.at(-1)?.[1]).toBe(3)
      detener()
    })

    it('si la dirección cambia por otro lado (Atrás, un enlace) la lista la sigue', async () => {
      const { filtros, detener } = armar()
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

      mocks.route.query = { estado: 'OPERATIVA', tipo: 'FUTBOL5' }
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(2))

      expect(filtros.estado).toBe('OPERATIVA')
      expect(filtros.tipo).toBe('FUTBOL5')
      detener()
    })

    it('al salir hacia otra ruta (la grilla) no reacciona a los parámetros de esa ruta', async () => {
      mocks.route.query = { estado: 'OPERATIVA' }
      const { filtros, detener } = armar()
      await vi.waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))

      mocks.route.name = 'cancha-turnos'
      mocks.route.query = { desde: 'canchas' }
      await nextTick()

      expect(filtros.estado).toBe('OPERATIVA')
      expect(mocks.buscar).toHaveBeenCalledTimes(1)
      expect(mocks.replace).not.toHaveBeenCalled()
      detener()
    })

    it('ofrece los parámetros con que la grilla reconstruye esta lista', () => {
      mocks.route.query = { sede: '2', tipo: 'PADDLE', estado: 'OPERATIVA', pagina: '2' }
      const { parametrosDetalle, detener } = armar()

      expect(parametrosDetalle.value).toEqual({ desde: 'canchas', sede: '2', tipo: 'PADDLE', estado: 'OPERATIVA', pagina: '2' })
      detener()
    })
  })

  // hayFiltrosActivos y limpiarFiltros se prueban en useCanchasFiltros.spec.ts.

  it('una página fuera de rango vuelve a la última', async () => {
    mocks.route.query = { pagina: '9' }
    mocks.buscar.mockResolvedValue({ items: [], total: 25 })
    const { detener } = armar()

    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalled())

    expect(ultimoReplace()).toEqual({ query: { pagina: '3' } })
    detener()
  })

  it('si falla la consulta deja el error y vacía la lista', async () => {
    mocks.buscar.mockRejectedValue(new Error('boom'))
    const { error, items, detener } = armar()

    await vi.waitFor(() => expect(error.value).toBe('No se pudieron cargar las canchas.'))

    expect(items.value).toEqual([])
    detener()
  })
})
