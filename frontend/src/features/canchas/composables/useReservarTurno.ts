import { computed, ref } from 'vue'
import { useServicios } from '@/compartido/servicios'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { esConflictoDeReserva, mensajeReserva } from '../errores'
import type { ReservaCancha } from '../services/servicioCanchas'

export interface TurnoElegido {
  inicio: string
  fin: string
}

export function useReservarTurno(alCambiarGrilla: () => void | Promise<void>) {
  const servicio = useServicios().canchas
  const { usuarioId } = useUsuarioSesion()

  const enviando = ref(false)
  const error = ref<string | null>(null)
  const reserva = ref<ReservaCancha | null>(null)

  async function reservar(canchaId: number, turno: TurnoElegido): Promise<boolean> {
    if (enviando.value) return false
    const idUsuario = usuarioId.value
    if (idUsuario === null) {
      error.value = 'No se pudo identificar al usuario de la sesión.'
      return false
    }

    enviando.value = true
    error.value = null
    reserva.value = null
    try {
      reserva.value = await servicio.crearReserva({
        canchaId,
        usuarioId: idUsuario,
        fechaHoraInicio: turno.inicio,
        fechaHoraFin: turno.fin,
      })
      await alCambiarGrilla()
      return true
    } catch (e) {
      error.value = mensajeReserva(e)
      if (esConflictoDeReserva(e)) await alCambiarGrilla()
      return false
    } finally {
      enviando.value = false
    }
  }

  function limpiar() {
    error.value = null
    reserva.value = null
  }

  const confirmada = computed(() => reserva.value !== null)

  return { enviando, error, reserva, confirmada, reservar, limpiar }
}
