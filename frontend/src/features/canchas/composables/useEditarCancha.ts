import { reactive, ref } from 'vue'
import { esErrorApi } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import {
  MENSAJE_SIN_CAMBIOS,
  cambiosDe,
  formularioDe,
  validarEdicion,
  type FormularioEdicionCancha,
} from '../edicion'
import { mensajeCancha } from '../errores'
import type { Cancha } from '../services/servicioCanchas'

// Edición de una cancha (GERENTE): costo por hora y estado. Los errores quedan en el estado para mostrarlos dentro del modal.
export function useEditarCancha() {
  const servicio = useServicios().canchas

  const form = reactive<FormularioEdicionCancha>({ costoPorHora: '', estado: 'OPERATIVA' })
  const original = ref<Cancha | null>(null)

  const guardando = ref(false)
  const error = ref<string | null>(null)
  const errores = ref<Record<string, string>>({})

  // Deja el formulario con los valores actuales de la cancha (el modal lo usa cada vez que se abre).
  function iniciar(cancha: Cancha) {
    original.value = cancha
    Object.assign(form, formularioDe(cancha))
    error.value = null
    errores.value = {}
  }

  // Devuelve la cancha actualizada, o null si no se pudo (los errores quedan en el estado).
  async function guardar(): Promise<Cancha | null> {
    const cancha = original.value
    if (guardando.value || !cancha) return null

    guardando.value = true
    error.value = null
    try {
      errores.value = validarEdicion(form)
      if (Object.keys(errores.value).length > 0) return null

      // Solo viaja lo que cambió; sin cambios no hay nada que guardar (el servidor rechazaría un PATCH vacío).
      const cambios = cambiosDe(cancha, form)
      if (Object.keys(cambios).length === 0) {
        error.value = MENSAJE_SIN_CAMBIOS
        return null
      }
      return await servicio.modificar(cancha.id, cambios)
    } catch (e) {
      if (esErrorApi(e) && e.status === 404) error.value = 'La cancha ya no existe. Actualizá la lista.'
      else error.value = mensajeCancha(e, 'No se pudo actualizar la cancha.')
      return null
    } finally {
      guardando.value = false
    }
  }

  return { form, guardando, error, errores, iniciar, guardar }
}
