import { reactive, ref } from 'vue'
import { esErrorApi, mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { Sede, SedeIn } from '../services/servicioSedes'

export function useAltaSede(opciones?: { alExito?: (sede: Sede) => void }) {
  const servicioSedes = useServicios().sedes

  const form = reactive<SedeIn>({
    nombre: '',
    direccion: '',
    aforoMaximo: 50,
  })

  const guardando = ref(false)
  const error = ref<string | null>(null)
  const erroresValidacion = ref<Record<string, string>>({})
  const sedeCreada = ref<Sede | null>(null)

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

  async function crear() {
    if (!validar()) return

    guardando.value = true
    error.value = null
    sedeCreada.value = null

    try {
      const creada = await servicioSedes.crear({
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim(),
        aforoMaximo: Number(form.aforoMaximo),
      })

      sedeCreada.value = creada
      opciones?.alExito?.(creada)
    } catch (e) {
      if (esErrorApi(e) && e.status === 422) {
        error.value = e.problema?.detail ?? 'Datos de la sede inválidos.'
      } else {
        error.value = mensajeDeError(e, 'No se pudo crear la sucursal.')
      }
    } finally {
      guardando.value = false
    }
  }

  function reiniciar() {
    form.nombre = ''
    form.direccion = ''
    form.aforoMaximo = 50
    error.value = null
    erroresValidacion.value = {}
    sedeCreada.value = null
  }

  return {
    form,
    guardando,
    error,
    erroresValidacion,
    sedeCreada,
    crear,
    reiniciar,
  }
}
