import { reactive, ref } from 'vue'
import { esErrorApi } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import { mensajeCancha } from '../errores'
import { TIPOS_CANCHA } from '../presentacion'
import type { Cancha, TipoCancha } from '../services/servicioCanchas'
import type { FormularioCanchaDatos } from '../tipos'

export const TIPO_CANCHA_INICIAL: TipoCancha = 'PADDLE'

export function useAltaCancha() {
  const servicio = useServicios().canchas

  const form = reactive<FormularioCanchaDatos>({ sedeId: '', tipo: TIPO_CANCHA_INICIAL, costoPorHora: '' })

  const guardando = ref(false)
  const error = ref<string | null>(null)
  const errores = ref<Record<string, string>>({})

  // Deja el formulario como recién abierto (el modal lo usa cada vez que se abre): arranca en la sede que se le pase.
  function reiniciar(sedeInicial: number | null = null) {
    form.sedeId = sedeInicial === null ? '' : String(sedeInicial)
    form.tipo = TIPO_CANCHA_INICIAL
    form.costoPorHora = ''
    error.value = null
    errores.value = {}
  }

  // Validación de ayuda de uso: el servidor siempre decide.
  function validar(): boolean {
    const nuevos: Record<string, string> = {}
    if (!form.sedeId) nuevos.sedeId = 'Elegí la sede de la cancha.'
    if (!TIPOS_CANCHA.some((tipo) => tipo === form.tipo)) nuevos.tipo = 'Elegí el deporte de la cancha.'
    const costo = Number(form.costoPorHora)
    if (form.costoPorHora.trim() === '' || !Number.isFinite(costo) || costo < 0) {
      nuevos.costoPorHora = 'Ingresá un costo por hora de cero o más.'
    }
    errores.value = nuevos
    return Object.keys(nuevos).length === 0
  }

  // Devuelve la cancha creada, o null si no se pudo (los errores quedan en el estado).
  async function crear(): Promise<Cancha | null> {
    if (guardando.value || !validar()) return null
    const tipo = TIPOS_CANCHA.find((valor) => valor === form.tipo)
    if (!tipo) return null

    guardando.value = true
    error.value = null
    try {
      // La cancha se crea operativa; el mantenimiento se cambia desde la gestión.
      return await servicio.crear(Number(form.sedeId), {
        tipo,
        costoPorHora: Number(form.costoPorHora),
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
