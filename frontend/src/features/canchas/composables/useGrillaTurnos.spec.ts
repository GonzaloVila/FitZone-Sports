import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref, type Ref } from 'vue'
import { ServiciosKey, type Servicios } from '@/compartido/servicios'
import { useGrillaTurnos } from './useGrillaTurnos'

// RF-10: la grilla de turnos de una cancha para un día. Trae la cancha (para saber si está en mantenimiento) y la
// disponibilidad del día; al cambiar la fecha, vuelve a consultar.
const CANCHA = { id: 4, sedeId: 1, tipo: 'PADDLE', costoPorHora: 12000, estado: 'OPERATIVA' }
const turno = (hora: number, disponible = true) => ({
  fechaHoraInicio: `2026-11-12T${hora}:00:00-03:00`,
  fechaHoraFin: `2026-11-12T${hora + 1}:00:00-03:00`,
  disponible,
})

// `preparar` ajusta los dobles antes de montar: el composable consulta apenas se crea.
function montar(fecha: Ref<string>, preparar?: (canchas: { obtener: ReturnType<typeof vi.fn>; consultarDisponibilidad: ReturnType<typeof vi.fn> }) => void) {
  const canchas = {
    obtener: vi.fn().mockResolvedValue(CANCHA),
    consultarDisponibilidad: vi.fn().mockResolvedValue({ items: [turno(10), turno(11, false)], total: 2 }),
  }
  preparar?.(canchas)
  let api!: ReturnType<typeof useGrillaTurnos>
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useGrillaTurnos(4, fecha)
        return {}
      },
      template: '<div />',
    }),
    { global: { provide: { [ServiciosKey as symbol]: { canchas } as unknown as Servicios } } },
  )
  return { api, canchas, wrapper }
}

describe('useGrillaTurnos', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] }))
  afterEach(() => vi.useRealTimers())

  it('trae la cancha y los turnos del día', async () => {
    const { api, canchas } = montar(ref('2026-11-12'))
    await flushPromises()

    expect(canchas.obtener).toHaveBeenCalledWith(4, expect.any(AbortSignal))
    expect(canchas.consultarDisponibilidad).toHaveBeenCalledWith(4, '2026-11-12', expect.any(AbortSignal))
    expect(api.cancha.value).toEqual(CANCHA)
    expect(api.turnos.value).toHaveLength(2)
    expect(api.cargando.value).toBe(false)
    expect(api.cargandoCancha.value).toBe(false)
    expect(api.mantenimiento.value).toBe(false)
  })

  it('avisa si la cancha está en mantenimiento', async () => {
    const { api } = montar(ref('2026-11-12'), (c) => c.obtener.mockResolvedValue({ ...CANCHA, estado: 'EN_MANTENIMIENTO' }))
    await flushPromises()

    expect(api.mantenimiento.value).toBe(true)
  })

  it('sin fecha no consulta turnos', async () => {
    const { api, canchas } = montar(ref(''))
    await flushPromises()

    expect(canchas.consultarDisponibilidad).not.toHaveBeenCalled()
    expect(api.turnos.value).toEqual([])
    expect(api.cargando.value).toBe(false)
  })

  it('al cambiar la fecha consulta el día nuevo y cancela la consulta anterior', async () => {
    const fecha = ref('2026-11-12')
    let resolverVieja!: (v: unknown) => void
    const { api, canchas } = montar(fecha, (c) =>
      c.consultarDisponibilidad
        .mockImplementationOnce(() => new Promise((r) => (resolverVieja = r)))
        .mockResolvedValueOnce({ items: [turno(18)], total: 1 }),
    )

    // La respuesta del día anterior llega tarde: no pisa la del día nuevo.
    fecha.value = '2026-11-13'
    await flushPromises()
    resolverVieja({ items: [turno(10)], total: 1 })
    await flushPromises()

    const senalVieja = canchas.consultarDisponibilidad.mock.calls[0]![2] as AbortSignal
    expect(senalVieja.aborted).toBe(true)
    expect(canchas.consultarDisponibilidad).toHaveBeenLastCalledWith(4, '2026-11-13', expect.any(AbortSignal))
    expect(api.turnos.value).toEqual([turno(18)])
  })

  it('errores de la cancha y de la grilla se informan por separado', async () => {
    const { api } = montar(ref('2026-11-12'), (c) => {
      c.obtener.mockRejectedValue(new Error('caído'))
      c.consultarDisponibilidad.mockRejectedValue(new Error('caído'))
    })
    await flushPromises()

    expect(api.errorCancha.value).toBe('No se pudo cargar la cancha.')
    expect(api.cancha.value).toBeNull()
    expect(api.error.value).toBe('No se pudo cargar la grilla de turnos.')
    expect(api.turnos.value).toEqual([])
  })

  it('el reloj avanza cada 30 segundos y se apaga al salir de la pantalla', async () => {
    const { api, wrapper } = montar(ref('2026-11-12'))
    const inicio = api.ahora.value.getTime()

    vi.advanceTimersByTime(30_000)
    expect(api.ahora.value.getTime()).toBe(inicio + 30_000)

    wrapper.unmount()
    vi.advanceTimersByTime(30_000)
    expect(api.ahora.value.getTime()).toBe(inicio + 30_000)
  })
})
