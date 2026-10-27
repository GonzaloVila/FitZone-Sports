import { reactive, ref } from 'vue'
import { esErrorApi, mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { MENSAJE_FECHA_PASADA, campoConInicioPasado } from '../reglas'
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

  // RECEPCION tiene sede fija (la del token); el GERENTE elige y arranca sin sede elegida, sin precargar la sede activa.
  function sedePorDefecto(): string {
    return sedeId.value === null ? '' : String(sedeId.value)
  }

  const form = reactive<FormularioClaseDatos>({
    sedeId: sedePorDefecto(),
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

  // Deja el formulario como recién abierto (el modal lo usa cada vez que se abre).
  function reiniciar() {
    form.sedeId = sedePorDefecto()
    form.tipo = ''
    form.instructor = ''
    form.dia = ''
    form.horaInicio = ''
    form.horaFin = ''
    form.capacidad = ''
    error.value = null
    errores.value = {}
    claseCreada.value = null
  }

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
    // Fecha pasada según el reloj del navegador, junto con los demás errores; sin pisar uno más básico del mismo campo.
    const pasado = campoConInicioPasado(form.dia, form.horaInicio, Date.now())
    if (pasado && !nuevos[pasado]) nuevos[pasado] = MENSAJE_FECHA_PASADA
    const capacidad = Number(form.capacidad)
    if (form.capacidad === '' || !Number.isInteger(capacidad) || capacidad <= 0) {
      nuevos.capacidad = 'La capacidad debe ser un número entero mayor a cero.'
    }

    errores.value = nuevos
    return Object.keys(nuevos).length === 0
  }

  // Devuelve la clase creada, o null si no se pudo (los errores quedan en el estado).
  async function crear(): Promise<Clase | null> {
    if (guardando.value || !validar()) return null

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
      return creada
    } catch (e) {
      if (esErrorApi(e) && e.status === 409) {
        // La clase cae fuera del horario de la sede (o en el pasado según el reloj del servidor, que puede diferir del del
        // navegador): se muestra junto al campo de horario.
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
      return null
    } finally {
      guardando.value = false
    }
  }

  return { form, guardando, error, errores, claseCreada, crear, reiniciar }
}
