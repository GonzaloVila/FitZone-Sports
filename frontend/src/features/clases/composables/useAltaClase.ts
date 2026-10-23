import { reactive, ref } from 'vue'
import { esErrorApi, mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import type { Clase } from '../services/servicioClases'
import type { FormularioClaseDatos } from '../tipos'

// Las clases se dictan en la zona de las sedes (Argentina, UTC-03:00), igual que los ejemplos del contrato.
const OFFSET_SEDE = '-03:00'

function aIso(dia: string, hora: string): string {
  return `${dia}T${hora}:00${OFFSET_SEDE}`
}

export function useAltaClase(opciones?: { alExito?: (clase: Clase) => void }) {
  const servicio = useServicios().clases
  const { sedeId } = useUsuarioSesion()

  const form = reactive<FormularioClaseDatos>({
    // RECEPCION tiene sede fija; el GERENTE elige.
    sedeId: sedeId.value === null ? '' : String(sedeId.value),
    tipo: '',
    instructor: '',
    dia: '',
    horaInicio: '',
    horaFin: '',
    capacidad: '',
  })

  const guardando = ref(false)
  const error = ref<string | null>(null)
  const errores = ref<Record<string, string>>({})
  const claseCreada = ref<Clase | null>(null)

  // Validación de ayuda de uso: el servidor siempre decide.
  function validar(): boolean {
    const nuevos: Record<string, string> = {}

    if (!form.sedeId) nuevos.sedeId = 'Elegí la sede donde se dicta la clase.'
    if (!form.tipo.trim()) nuevos.tipo = 'La disciplina es obligatoria.'
    if (!form.instructor.trim()) nuevos.instructor = 'El instructor es obligatorio.'
    if (!form.dia) nuevos.dia = 'Elegí el día de la clase.'
    if (!form.horaInicio) nuevos.horaInicio = 'Indicá la hora de inicio.'
    if (!form.horaFin) nuevos.horaFin = 'Indicá la hora de fin.'
    if (form.horaInicio && form.horaFin && form.horaFin <= form.horaInicio) {
      nuevos.horaFin = 'La hora de fin tiene que ser posterior a la de inicio.'
    }
    const capacidad = Number(form.capacidad)
    if (form.capacidad === '' || !Number.isInteger(capacidad) || capacidad <= 0) {
      nuevos.capacidad = 'La capacidad debe ser un número entero mayor a cero.'
    }

    errores.value = nuevos
    return Object.keys(nuevos).length === 0
  }

  async function crear() {
    if (guardando.value || !validar()) return

    guardando.value = true
    error.value = null
    claseCreada.value = null
    try {
      const creada = await servicio.crear({
        sedeId: Number(form.sedeId),
        tipo: form.tipo.trim(),
        instructor: form.instructor.trim(),
        horarioInicio: aIso(form.dia, form.horaInicio),
        horarioFin: aIso(form.dia, form.horaFin),
        capacidad: Number(form.capacidad),
      })
      claseCreada.value = creada
      opciones?.alExito?.(creada)
    } catch (e) {
      if (esErrorApi(e) && e.status === 409) {
        // La clase cae fuera del horario de la sede (o en el pasado): se muestra junto al campo de horario.
        errores.value = {
          ...errores.value,
          horario: e.problema?.detail || 'La clase queda fuera del horario de la sede.',
        }
      } else if (esErrorApi(e) && e.status === 404) {
        errores.value = { ...errores.value, sedeId: 'La sede elegida no existe.' }
      } else if (esErrorApi(e) && e.status === 422) {
        error.value = e.problema?.detail || 'Los datos de la clase son inválidos.'
      } else {
        error.value = mensajeDeError(e, 'No se pudo crear la clase.')
      }
    } finally {
      guardando.value = false
    }
  }

  return { form, guardando, error, errores, claseCreada, crear }
}
