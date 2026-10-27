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

import { useVistaCanchas } from './useVistaCanchas'

function armar(tieneMisReservas: boolean) {
  return effectScope().run(() => useVistaCanchas(() => tieneMisReservas))!
}

describe('useVistaCanchas', () => {
  beforeEach(() => {
    mocks.route = reactive({ query: {} as Record<string, unknown> })
    mocks.push.mockReset()
  })

  it('sin query son las canchas', () => {
    expect(armar(true).vista.value).toBe('canchas')
  })

  it('quien reserva, con ?vista=mis-reservas, ve Mis reservas', () => {
    mocks.route.query = { vista: 'mis-reservas' }

    expect(armar(true).vista.value).toBe('mis-reservas')
  })

  it('un valor desconocido cae en las canchas', () => {
    mocks.route.query = { vista: 'otra-cosa' }

    expect(armar(true).vista.value).toBe('canchas')
  })

  it('quien no reserva (RECEPCION, GERENTE) ve siempre las canchas, aunque la dirección diga otra cosa', () => {
    mocks.route.query = { vista: 'mis-reservas' }

    expect(armar(false).vista.value).toBe('canchas')
  })

  it('elegir Mis reservas navega a la misma pantalla con ?vista=mis-reservas (Atrás vuelve a las canchas)', () => {
    const { vista } = armar(true)

    vista.value = 'mis-reservas'

    expect(mocks.push).toHaveBeenCalledWith({ query: { vista: 'mis-reservas' } })
  })

  it('elegir las canchas quita la query de vista y conserva las demás', () => {
    mocks.route.query = { vista: 'mis-reservas', otra: '1' }
    const { vista } = armar(true)

    vista.value = 'canchas'

    expect(mocks.push).toHaveBeenCalledWith({ query: { otra: '1' } })
  })

  it('elegir la vista que ya está activa no navega', () => {
    const { vista } = armar(true)

    vista.value = 'canchas'

    expect(mocks.push).not.toHaveBeenCalled()
  })
})
