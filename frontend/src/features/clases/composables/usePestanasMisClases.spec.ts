import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive } from 'vue'

const mocks = vi.hoisted(() => ({
  route: { query: {} as Record<string, unknown> },
  replace: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace }),
}))

import { usePestanasMisClases } from './usePestanasMisClases'

const armar = () => effectScope().run(() => usePestanasMisClases())!
const ultimoReplace = () => mocks.replace.mock.calls.at(-1)?.[0]

describe('usePestanasMisClases', () => {
  beforeEach(() => {
    mocks.route = reactive({ query: {} as Record<string, unknown> })
    // El router de verdad deja la dirección nueva en la ruta: acá se imita.
    mocks.replace.mockReset().mockImplementation(async ({ query }: { query: Record<string, unknown> }) => {
      mocks.route.query = query
    })
  })

  it('sin parámetros es Próximas, página 1, sin tocar la dirección', () => {
    const { pestana, pagina } = armar()

    expect(pestana.value).toBe('proximas')
    expect(pagina.value).toBe(1)
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('lee la pestaña y la página de la dirección', () => {
    mocks.route.query = { vista: 'mis-clases', pestana: 'pasadas', 'pagina-clases': '3' }
    const { pestana, pagina } = armar()

    expect(pestana.value).toBe('pasadas')
    expect(pagina.value).toBe(3)
  })

  it('un valor inválido se ignora como si no estuviera', () => {
    mocks.route.query = { pestana: 'futuras', 'pagina-clases': 'abc' }
    const { pestana, pagina } = armar()

    expect(pestana.value).toBe('proximas')
    expect(pagina.value).toBe(1)
  })

  it('elegir Pasadas escribe solo ?pestana=pasadas, reemplaza la entrada y conserva el resto de la dirección', () => {
    mocks.route.query = { vista: 'mis-clases' }
    const { pestana } = armar()

    pestana.value = 'pasadas'

    expect(ultimoReplace()).toEqual({ query: { vista: 'mis-clases', pestana: 'pasadas' } })
    expect(pestana.value).toBe('pasadas')
  })

  it('volver a Próximas quita los parámetros: se escribe solo lo que se aparta del valor por defecto', () => {
    mocks.route.query = { vista: 'mis-clases', pestana: 'pasadas', 'pagina-clases': '2' }
    const { pestana } = armar()

    pestana.value = 'proximas'

    expect(ultimoReplace()).toEqual({ query: { vista: 'mis-clases' } })
  })

  it('cambiar de pestaña vuelve a la página 1', () => {
    mocks.route.query = { pestana: 'pasadas', 'pagina-clases': '4' }
    const { pestana } = armar()

    pestana.value = 'proximas'

    expect(ultimoReplace()).toEqual({ query: {} })
  })

  it('la página se escribe como ?pagina-clases= (no `pagina`) desde la 2, y la 1 se quita', () => {
    mocks.route.query = { pestana: 'pasadas', pagina: '5' }
    const { pagina } = armar()

    pagina.value = 2
    expect(ultimoReplace()).toEqual({ query: { pagina: '5', pestana: 'pasadas', 'pagina-clases': '2' } })

    pagina.value = 1
    expect(ultimoReplace()).toEqual({ query: { pagina: '5', pestana: 'pasadas' } })
  })

  it('elegir la pestaña o la página que ya están no navega', () => {
    mocks.route.query = { pestana: 'pasadas', 'pagina-clases': '2' }
    const { pestana, pagina } = armar()

    pestana.value = 'pasadas'
    pagina.value = 2

    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('una pestaña desconocida cae en Próximas', () => {
    mocks.route.query = { pestana: 'pasadas' }
    const { pestana } = armar()

    pestana.value = 'otra'

    expect(ultimoReplace()).toEqual({ query: {} })
  })
})
