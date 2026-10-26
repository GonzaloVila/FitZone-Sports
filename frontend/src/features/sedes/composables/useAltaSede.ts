import { reactive, ref } from 'vue'
import { useServicios } from '@/compartido/servicios'
import { repartirErroresSede } from '../erroresSede'
import type { Sede, SedeIn } from '../services/servicioSedes'

export function useAltaSede(opciones?: { alExito?: (sede: Sede) => void }) {
  const servicioSedes = useServicios().sedes

  const form = reactive<SedeIn>({
    nombre: '',
    direccion: '',
    aforoMaximo: 50,
  })

  const guardando = ref(false)
  // Error general del servidor y errores por campo (los de la validación de ayuda y los del servidor), para mostrar
  // dentro del modal.
  const error = ref<string | null>(null)
  const erroresValidacion = ref<Record<string, string>>({})

  function validar(): boolean {
    erroresValidacion.value = {}

    if (!form.nombre.trim()) {
      erroresValidacion.value.nombre = 'El nombre de la sede es obligatorio.'
    }
    if (!form.direccion.trim()) {
      erroresValidacion.value.direccion = 'La dirección es obligatoria.'
    }
    const aforo = Number(form.aforoMaximo)
    if (isNaN(aforo) || aforo <= 0 || !Number.isInteger(aforo)) {
      erroresValidacion.value.aforoMaximo = 'La capacidad debe ser un número entero mayor a cero.'
    }

    return Object.keys(erroresValidacion.value).length === 0
  }

  // Devuelve la sede creada, o null si no se pudo (los errores quedan en el estado).
  async function crear(): Promise<Sede | null> {
    if (guardando.value || !validar()) return null

    guardando.value = true
    error.value = null

    try {
      const creada = await servicioSedes.crear({
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim(),
        aforoMaximo: Number(form.aforoMaximo),
      })
      opciones?.alExito?.(creada)
      return creada
    } catch (e) {
      const { campos, general } = repartirErroresSede(e)
      erroresValidacion.value = campos
      error.value = general
      return null
    } finally {
      guardando.value = false
    }
  }

  // Deja el formulario como recién abierto (el modal lo usa cada vez que se abre).
  function reiniciar() {
    form.nombre = ''
    form.direccion = ''
    form.aforoMaximo = 50
    error.value = null
    erroresValidacion.value = {}
  }

  return {
    form,
    guardando,
    error,
    erroresValidacion,
    crear,
    reiniciar,
  }
}
