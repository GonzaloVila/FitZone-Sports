import { onScopeDispose, ref } from 'vue'

export interface OpcionesActualizacionPeriodica {
  intervaloMs?: number
  inmediato?: boolean
}

/**
 * Repite una función asíncrona periódicamente (por defecto cada 10s).
 * - Se suspende automáticamente mientras la pestaña esté oculta (document.visibilityState === 'hidden')
 *   para evitar llamadas y sobrecarga innecesarias en segundo plano.
 * - Al volver a enfocarse la pestaña, se reanuda e invoca inmediatamente si pasó tiempo.
 * - Se detiene al salir del componente o destruirse el scope reactivo.
 */
export function useActualizacionPeriodica(
  tarea: () => Promise<void> | void,
  opciones: OpcionesActualizacionPeriodica = {},
) {
  const intervaloMs = opciones.intervaloMs ?? 10000
  const inmediato = opciones.inmediato ?? true

  const activa = ref(true)
  let temporizador: ReturnType<typeof setTimeout> | undefined

  async function ejecutar() {
    if (!activa.value) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return
    }

    try {
      await tarea()
    } catch {
      // Los errores individuales los gestiona la propia tarea; acá evitamos romper el loop.
    } finally {
      planificarSiguiente()
    }
  }

  function planificarSiguiente() {
    limpiar()
    if (!activa.value) return
    temporizador = setTimeout(() => {
      void ejecutar()
    }, intervaloMs)
  }

  function limpiar() {
    if (temporizador) {
      clearTimeout(temporizador)
      temporizador = undefined
    }
  }

  function manejarVisibilidad() {
    if (document.visibilityState === 'visible' && activa.value) {
      void ejecutar()
    } else {
      limpiar()
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', manejarVisibilidad)
  }

  if (inmediato) {
    void ejecutar()
  } else {
    planificarSiguiente()
  }

  function detener() {
    activa.value = false
    limpiar()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', manejarVisibilidad)
    }
  }

  function reanudar() {
    if (activa.value) return
    activa.value = true
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', manejarVisibilidad)
    }
    void ejecutar()
  }

  onScopeDispose(() => {
    detener()
  })

  return {
    activa,
    detener,
    reanudar,
    ejecutarAhora: ejecutar,
  }
}
