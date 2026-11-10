import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useActualizacionPeriodica } from './useActualizacionPeriodica'

// El refresco automático del aforo (RF-06): repite una tarea cada N ms, se suspende con la pestaña oculta y se apaga al
// destruirse el componente.
function visibilidad(estado: 'visible' | 'hidden') {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(estado)
  document.dispatchEvent(new Event('visibilitychange'))
}

function iniciar(opciones?: Parameters<typeof useActualizacionPeriodica>[1], tarea = vi.fn()) {
  const alcance = effectScope()
  const api = alcance.run(() => useActualizacionPeriodica(tarea, opciones))!
  return { api, tarea, alcance }
}

describe('useActualizacionPeriodica', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('por defecto corre ya y después cada 10 segundos', async () => {
    const { tarea, alcance } = iniciar()
    expect(tarea).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(tarea).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(tarea).toHaveBeenCalledTimes(3)
    alcance.stop()
  })

  it('con inmediato: false espera el primer intervalo', async () => {
    const { tarea, alcance } = iniciar({ intervaloMs: 5_000, inmediato: false })
    expect(tarea).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(tarea).toHaveBeenCalledTimes(1)
    alcance.stop()
  })

  it('un error de la tarea no corta el ciclo', async () => {
    const tarea = vi.fn().mockRejectedValueOnce(new Error('falló')).mockResolvedValue(undefined)
    const { alcance } = iniciar({ intervaloMs: 1_000 }, tarea)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(tarea).toHaveBeenCalledTimes(2)
    alcance.stop()
  })

  it('con la pestaña oculta se suspende y al volver corre en el momento', async () => {
    const { tarea, alcance } = iniciar({ intervaloMs: 1_000, inmediato: false })

    visibilidad('hidden')
    await vi.advanceTimersByTimeAsync(5_000)
    expect(tarea).not.toHaveBeenCalled()

    visibilidad('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(tarea).toHaveBeenCalledTimes(1)
    alcance.stop()
  })

  it('detener corta el ciclo y reanudar lo vuelve a arrancar en el momento', async () => {
    const { api, tarea, alcance } = iniciar({ intervaloMs: 1_000, inmediato: false })

    api.detener()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(tarea).not.toHaveBeenCalled()
    expect(api.activa.value).toBe(false)

    api.reanudar()
    await vi.advanceTimersByTimeAsync(0)
    expect(tarea).toHaveBeenCalledTimes(1)
    api.reanudar() // ya activa: no hace nada
    expect(tarea).toHaveBeenCalledTimes(1)
    alcance.stop()
  })

  it('al destruirse el componente (scope) deja de correr', async () => {
    const { tarea, alcance } = iniciar({ intervaloMs: 1_000, inmediato: false })

    alcance.stop()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(tarea).not.toHaveBeenCalled()
  })

  it('ejecutarAhora corre fuera de turno y reinicia la espera', async () => {
    const { api, tarea, alcance } = iniciar({ intervaloMs: 1_000, inmediato: false })

    await vi.advanceTimersByTimeAsync(600)
    await api.ejecutarAhora()
    expect(tarea).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(600)
    expect(tarea).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(400)
    expect(tarea).toHaveBeenCalledTimes(2)
    alcance.stop()
  })
})
