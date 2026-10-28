import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive } from 'vue'

const mocks = vi.hoisted(() => ({
  route: { query: {} as Record<string, unknown> },
  push: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ push: mocks.push }),
}))

import { useVistaClases } from './useVistaClases'

function armar(esSocio: boolean) {
  return effectScope().run(() => useVistaClases(() => esSocio))!
}

describe('useVistaClases', () => {
  beforeEach(() => {
    mocks.route = reactive({ query: {} as Record<string, unknown> })
    mocks.push.mockReset()
  })

  it('sin query es la agenda', () => {
    expect(armar(true).vista.value).toBe('agenda')
  })

  it('el socio con ?vista=mis-clases ve Mis clases', () => {
    mocks.route.query = { vista: 'mis-clases' }

    expect(armar(true).vista.value).toBe('mis-clases')
  })

  it('un valor desconocido cae en la agenda', () => {
    mocks.route.query = { vista: 'otra-cosa' }

    expect(armar(true).vista.value).toBe('agenda')
  })

  it('quien no es socio ve siempre la agenda, aunque la dirección diga otra cosa', () => {
    mocks.route.query = { vista: 'mis-clases' }

    expect(armar(false).vista.value).toBe('agenda')
  })

  it('elegir Mis clases navega a la misma pantalla con ?vista=mis-clases (Atrás vuelve a la agenda)', () => {
    const { vista } = armar(true)

    vista.value = 'mis-clases'

    expect(mocks.push).toHaveBeenCalledWith({ query: { vista: 'mis-clases' } })
  })

  it('elegir la agenda quita la query de vista y conserva las demás', () => {
    mocks.route.query = { vista: 'mis-clases', otra: '1' }
    const { vista } = armar(true)

    vista.value = 'agenda'

    expect(mocks.push).toHaveBeenCalledWith({ query: { otra: '1' } })
  })

  it('cambiar de vista quita la pestaña y la página de Mis clases, pero no la página de la agenda', () => {
    mocks.route.query = { vista: 'mis-clases', pestana: 'pasadas', 'pagina-clases': '2', pagina: '3', sede: '1' }
    const { vista } = armar(true)

    vista.value = 'agenda'

    expect(mocks.push).toHaveBeenCalledWith({ query: { pagina: '3', sede: '1' } })
  })

  it('pasar a Mis clases tampoco arrastra una pestaña o página que hubieran quedado', () => {
    mocks.route.query = { pestana: 'pasadas', 'pagina-clases': '2', tipo: 'Yoga' }
    const { vista } = armar(true)

    vista.value = 'mis-clases'

    expect(mocks.push).toHaveBeenCalledWith({ query: { tipo: 'Yoga', vista: 'mis-clases' } })
  })

  it('elegir la vista que ya está activa no navega', () => {
    const { vista } = armar(true)

    vista.value = 'agenda'

    expect(mocks.push).not.toHaveBeenCalled()
  })
})
