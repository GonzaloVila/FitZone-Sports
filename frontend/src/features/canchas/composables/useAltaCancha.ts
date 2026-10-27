import { reactive, ref } from 'vue'
import { comoTexto } from '@/compartido/comoTexto'
import { esErrorApi } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { mensajeCancha } from '../errores'
import { TIPOS_CANCHA } from '../presentacion'
import type { Cancha } from '../services/servicioCanchas'
import type { FormularioCanchaDatos } from '../tipos'

export function useAltaCancha() {
  const servicio = useServicios().canchas

  // La sede y el deporte arrancan sin elegir (criterio de los formularios de alta): no se precarga la sede activa ni el
  // primer deporte.
  const form = reactive<FormularioCanchaDatos>({ sedeId: '', tipo: '', costoPorHora: '' })

  const guardando = ref(false)
  const error = ref<string | null>(null)
  const errores = ref<Record<string, string>>({})

  // Deja el formulario como recién abierto (el modal lo usa cada vez que se abre).
  function reiniciar() {
    form.sedeId = ''
    form.tipo = ''
    form.costoPorHora = ''
    error.value = null
    errores.value = {}
  }

  // Validación de ayuda de uso: el servidor siempre decide.
  function validar(): boolean {
    const nuevos: Record<string, string> = {}
    if (!form.sedeId) nuevos.sedeId = 'Elegí la sede de la cancha.'
    if (!TIPOS_CANCHA.some((tipo) => tipo === form.tipo)) nuevos.tipo = 'Elegí el deporte de la cancha.'
    // El campo numérico entrega un número en runtime: se pasa a texto antes de mirarlo.
    const costoTexto = comoTexto(form.costoPorHora)
    const costo = Number(costoTexto)
    if (costoTexto === '' || !Number.isFinite(costo) || costo < 0) {
      nuevos.costoPorHora = 'Ingresá un costo por hora de cero o más.'
    }
    errores.value = nuevos
    return Object.keys(nuevos).length === 0
  }

  // Devuelve la cancha creada, o null si no se pudo (los errores quedan en el estado).
  async function crear(): Promise<Cancha | null> {
    if (guardando.value) return null

    guardando.value = true
    error.value = null
    try {
      if (!validar()) return null
      const tipo = TIPOS_CANCHA.find((valor) => valor === form.tipo)
      if (!tipo) return null

      // La cancha se crea operativa; el mantenimiento se cambia al editarla.
      return await servicio.crear(Number(form.sedeId), {
        tipo,
        costoPorHora: Number(comoTexto(form.costoPorHora)),
        estado: 'OPERATIVA',
      })
    } catch (e) {
      if (esErrorApi(e) && e.status === 404) errores.value = { ...errores.value, sedeId: 'La sede elegida no existe.' }
      else error.value = mensajeCancha(e, 'No se pudo crear la cancha.')
      return null
    } finally {
      guardando.value = false
    }
  }

  return { form, guardando, error, errores, crear, reiniciar }
}
