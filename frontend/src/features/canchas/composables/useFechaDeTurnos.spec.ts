import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'

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

  it('sin ?fecha= es hoy, el campo arranca en hoy y el rango termina en hoy + 6', () => {
    const { fecha, campo, hoy, ultimo } = armar()

    expect(hoy).toBe(HOY)
    expect(ultimo).toBe('2026-11-18')
    expect(fecha.value).toBe(HOY)
    expect(campo.value).toBe(HOY)
  })

  it('lee la fecha de la dirección y descarta la que está fuera del rango', () => {
    mocks.route.query = { fecha: '2026-11-15' }
    const dentro = armar()
    expect(dentro.fecha.value).toBe('2026-11-15')
    expect(dentro.campo.value).toBe('2026-11-15')

    mocks.route.query = { fecha: '2026-12-25' }
    expect(armar().fecha.value).toBe(HOY)

    mocks.route.query = { fecha: 'cualquier-cosa' }
    expect(armar().fecha.value).toBe(HOY)
  })

  it('elegir un día en el campo reemplaza la dirección (no agrega una entrada) y conserva el origen y los filtros', async () => {
    mocks.route.query = { desde: 'canchas', sede: '2', tipo: 'PADDLE' }
    const { fecha, campo } = armar()

    campo.value = '2026-11-14'
    await nextTick()

    expect(mocks.replace).toHaveBeenCalledTimes(1)
    expect(mocks.replace).toHaveBeenCalledWith({ query: { desde: 'canchas', sede: '2', tipo: 'PADDLE', fecha: '2026-11-14' } })
    expect(fecha.value).toBe('2026-11-14')
  })

  it('el último día del rango es válido', async () => {
    const { fecha, campo } = armar()

    campo.value = '2026-11-18'
    await nextTick()

    expect(fecha.value).toBe('2026-11-18')
  })

  it('volver a hoy quita ?fecha= de la dirección', async () => {
    mocks.route.query = { desde: 'canchas', fecha: '2026-11-14' }
    const { fecha, campo } = armar()

    campo.value = HOY
    await nextTick()

    expect(mocks.replace).toHaveBeenCalledWith({ query: { desde: 'canchas' } })
    expect(fecha.value).toBe(HOY)
  })

  it('un día fuera del rango (pasado o más allá del último) no cambia la dirección y el campo vuelve al día que se mira', async () => {
    mocks.route.query = { fecha: '2026-11-14' }
    const { fecha, campo } = armar()

    for (const escrita of ['2026-11-11', '2026-11-19', '2027-01-01', '2026-02-30']) {
      campo.value = escrita
      await nextTick()
      await nextTick()

      expect(campo.value, escrita).toBe('2026-11-14')
    }
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(fecha.value).toBe('2026-11-14')
  })

  it('un campo vacío (mientras se edita) no cambia nada', async () => {
    mocks.route.query = { fecha: '2026-11-14' }
    const { fecha, campo } = armar()

    campo.value = ''
    await nextTick()
    await nextTick()

    expect(mocks.replace).not.toHaveBeenCalled()
    expect(fecha.value).toBe('2026-11-14')
    expect(campo.value).toBe('')
  })

  it('si la dirección cambia por otro lado (Atrás, un enlace) el día y el campo la siguen', async () => {
    const { fecha, campo } = armar()

    mocks.route.query = { fecha: '2026-11-17' }
    await nextTick()

    expect(fecha.value).toBe('2026-11-17')
    expect(campo.value).toBe('2026-11-17')
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
