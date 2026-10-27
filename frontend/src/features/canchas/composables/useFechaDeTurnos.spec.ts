import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive } from 'vue'

const mocks = vi.hoisted(() => ({
  route: { name: 'cancha-turnos', query: {} as Record<string, unknown> },
  replace: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace }),
}))

import { useFechaDeTurnos } from './useFechaDeTurnos'

const HOY = '2026-11-12'

function armar() {
  return effectScope().run(() => useFechaDeTurnos(HOY))!
}

describe('useFechaDeTurnos', () => {
  beforeEach(() => {
    mocks.route = reactive({ name: 'cancha-turnos', query: {} as Record<string, unknown> })
    // El router de verdad deja la dirección nueva en la ruta: acá se imita.
    mocks.replace.mockReset().mockImplementation(async ({ query }: { query: Record<string, unknown> }) => {
      mocks.route.query = query
    })
  })

  it('sin ?fecha= es hoy y ofrece la tira de siete días desde hoy', () => {
    const { fecha, dias, hoy } = armar()

    expect(hoy).toBe(HOY)
    expect(fecha.value).toBe(HOY)
    expect(dias).toHaveLength(7)
    expect(dias[0]?.fecha).toBe(HOY)
  })

  it('lee la fecha de la dirección y descarta la que no es de la tira', () => {
    mocks.route.query = { fecha: '2026-11-15' }
    expect(armar().fecha.value).toBe('2026-11-15')

    mocks.route.query = { fecha: '2026-12-25' }
    expect(armar().fecha.value).toBe(HOY)

    mocks.route.query = { fecha: 'cualquier-cosa' }
    expect(armar().fecha.value).toBe(HOY)
  })

  it('elegir un día reemplaza la dirección (no agrega una entrada) y conserva el origen y los filtros', () => {
    mocks.route.query = { desde: 'canchas', sede: '2', tipo: 'PADDLE' }
    const { fecha } = armar()

    fecha.value = '2026-11-14'

    expect(mocks.replace).toHaveBeenCalledTimes(1)
    expect(mocks.replace).toHaveBeenCalledWith({ query: { desde: 'canchas', sede: '2', tipo: 'PADDLE', fecha: '2026-11-14' } })
    expect(fecha.value).toBe('2026-11-14')
  })

  it('volver a hoy quita ?fecha= de la dirección', () => {
    mocks.route.query = { desde: 'canchas', fecha: '2026-11-14' }
    const { fecha } = armar()

    fecha.value = HOY

    expect(mocks.replace).toHaveBeenCalledWith({ query: { desde: 'canchas' } })
    expect(fecha.value).toBe(HOY)
  })

  it('si la dirección cambia por otro lado (Atrás, un enlace) el día la sigue', () => {
    const { fecha } = armar()

    mocks.route.query = { fecha: '2026-11-17' }

    expect(fecha.value).toBe('2026-11-17')
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
