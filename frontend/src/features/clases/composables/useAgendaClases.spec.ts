import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  sedeId: { value: null as number | null },
  route: { name: 'clases', query: {} as Record<string, unknown> },
  replace: vi.fn(),
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ clases: { listar: mocks.listar } }),
}))

vi.mock('@/features/sesion/composables/useUsuarioSesion', () => ({
  useUsuarioSesion: () => ({ sedeId: mocks.sedeId }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace }),
}))

import { useAgendaClases } from './useAgendaClases'

function armar(sedePorDefecto?: Parameters<typeof useAgendaClases>[0]) {
  const scope = effectScope()
  const estado = scope.run(() => useAgendaClases(sedePorDefecto))!
  return { ...estado, detener: () => scope.stop() }
}

const sedeDeLaUltimaConsulta = () => mocks.listar.mock.calls.at(-1)?.[0].sedeId
const ultimoReplace = () => mocks.replace.mock.calls.at(-1)?.[0]

describe('useAgendaClases', () => {
  beforeEach(() => {
    mocks.listar.mockReset().mockResolvedValue({ items: [], total: 0 })
    mocks.sedeId.value = null
    mocks.route = reactive({ name: 'clases', query: {} as Record<string, unknown> })
    // El router de verdad deja la dirección nueva en la ruta: acá se imita.
    mocks.replace.mockReset().mockImplementation(async ({ query }: { query: Record<string, unknown> }) => {
      mocks.route.query = query
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('sede con la que arranca el filtro', () => {
    it('sin sede fija ni por defecto muestra todas las sedes', async () => {
      const { filtros, detener } = armar()
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

      expect(filtros.sede).toBe('')
      expect(sedeDeLaUltimaConsulta()).toBeUndefined()
      detener()
    })

    it('con una sede por defecto disponible arranca filtrando por ella, en una sola consulta', async () => {
      const { filtros, detener } = armar(() => 4)
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

      expect(filtros.sede).toBe('4')
      expect(sedeDeLaUltimaConsulta()).toBe(4)
      detener()
    })

    it('la sede por defecto no se escribe en la dirección: sin parámetro es "la de hoy"', async () => {
      const { detener } = armar(() => 4)
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

      expect(mocks.replace).not.toHaveBeenCalled()
      detener()
    })

    it('si la sede por defecto llega después (cargan las sedes) filtra por ella y vuelve a consultar', async () => {
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

    it('elegir "todas" queda en la dirección (sede=todas) y no vuelve sola a la sede por defecto', async () => {
      const inicial = ref<number | null>(3)
      const { filtros, detener } = armar(inicial)
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

      filtros.sede = ''
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))
      inicial.value = 5
      await nextTick()

      expect(ultimoReplace()).toEqual({ query: { sede: 'todas' } })
      expect(filtros.sede).toBe('')
      expect(sedeDeLaUltimaConsulta()).toBeUndefined()
      expect(mocks.listar).toHaveBeenCalledTimes(2)
      detener()
    })

    it('el RECEPCION con sede en el token ignora un ?sede= de la dirección', async () => {
      mocks.sedeId.value = 2
      mocks.route.query = { sede: '9' }
      const { filtros, detener } = armar()
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

      expect(filtros.sede).toBe('2')
      expect(sedeDeLaUltimaConsulta()).toBe(2)
      detener()
    })

    it('el RECEPCION arranca en su sede aunque la sede por defecto sea otra', async () => {
      mocks.sedeId.value = 2
      const { filtros, detener } = armar(() => 9)
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

      expect(filtros.sede).toBe('2')
      expect(sedeDeLaUltimaConsulta()).toBe(2)
      detener()
    })
  })

  describe('filtros y página en la dirección', () => {
    it('arranca con lo que dice la dirección', async () => {
      mocks.route.query = { tipo: 'Yoga', sede: '3', pagina: '2' }
      const { filtros, pagina, detener } = armar()
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

      expect(filtros.tipo).toBe('Yoga')
      expect(filtros.sede).toBe('3')
      expect(pagina.value).toBe(2)
      expect(mocks.listar).toHaveBeenCalledWith({ tipo: 'Yoga', sedeId: 3 }, 2, 10, expect.anything())
      detener()
    })

    it('valores inválidos de la dirección se ignoran sin romper', async () => {
      mocks.route.query = { tipo: ['a', 'b'], sede: 'xx', pagina: '-4', otra: 'cosa' }
      const { filtros, pagina, detener } = armar()
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

      expect(filtros.tipo).toBe('a')
      expect(filtros.sede).toBe('')
      expect(pagina.value).toBe(1)
      detener()
    })

    it('elegir una sede reemplaza la dirección (no agrega una entrada), vuelve a la página 1 y conserva la vista', async () => {
      mocks.route.query = { vista: 'agenda', pagina: '3' }
      const { filtros, detener } = armar()
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

      filtros.sede = '5'

      expect(ultimoReplace()).toEqual({ query: { vista: 'agenda', sede: '5' } })
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))
      expect(mocks.listar).toHaveBeenLastCalledWith({ tipo: undefined, sedeId: 5 }, 1, 10, expect.anything())
      detener()
    })

    it('cambiar de página reemplaza la dirección y consulta esa página', async () => {
      mocks.listar.mockResolvedValue({ items: [], total: 35 })
      const { pagina, detener } = armar()
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

      pagina.value = 3

      expect(ultimoReplace()).toEqual({ query: { pagina: '3' } })
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))
      expect(mocks.listar.mock.calls.at(-1)?.[1]).toBe(3)
      detener()
    })

    it('la disciplina se escribe en la dirección con retraso, no en cada tecla', async () => {
      const { filtros, detener } = armar()
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))
      vi.useFakeTimers()

      filtros.tipo = 'Y'
      await nextTick()
      filtros.tipo = 'Yo'
      await nextTick()
      filtros.tipo = ' Yoga '
      await nextTick()
      expect(mocks.replace).not.toHaveBeenCalled()

      vi.advanceTimersByTime(300)

      expect(mocks.replace).toHaveBeenCalledTimes(1)
      expect(ultimoReplace()).toEqual({ query: { tipo: 'Yoga' } })
      detener()
    })

    it('si la dirección cambia por otro lado (Atrás, un enlace) el campo y la consulta la siguen', async () => {
      mocks.route.query = { tipo: 'Yoga' }
      const { filtros, detener } = armar()
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

      mocks.route.query = { tipo: 'Spinning', sede: 'todas' }
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2))

      expect(filtros.tipo).toBe('Spinning')
      expect(mocks.listar).toHaveBeenLastCalledWith({ tipo: 'Spinning', sedeId: undefined }, 1, 10, expect.anything())
      detener()
    })

    it('al salir hacia otra ruta (el detalle) no reacciona a los parámetros de esa ruta', async () => {
      mocks.route.query = { tipo: 'Yoga' }
      const { filtros, detener } = armar()
      await vi.waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(1))

      mocks.route.name = 'clase-detalle'
      mocks.route.query = { desde: 'mis-clases' }
      await nextTick()

      expect(filtros.tipo).toBe('Yoga')
      expect(mocks.listar).toHaveBeenCalledTimes(1)
      expect(mocks.replace).not.toHaveBeenCalled()
      detener()
    })

    it('ofrece los parámetros con que el detalle reconstruye esta agenda', async () => {
      mocks.route.query = { tipo: 'Yoga', sede: 'todas', pagina: '2' }
      const { parametrosDetalle, detener } = armar()

      expect(parametrosDetalle.value).toEqual({ desde: 'agenda', tipo: 'Yoga', sede: 'todas', pagina: '2' })
      detener()
    })

    it('una página fuera de rango vuelve a la última', async () => {
      mocks.route.query = { pagina: '9' }
      mocks.listar.mockResolvedValue({ items: [], total: 25 })
      const { detener } = armar()

      await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalled())

      expect(ultimoReplace()).toEqual({ query: { pagina: '3' } })
      detener()
    })
  })
})
