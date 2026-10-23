import { computed, ref, watch, type Ref } from 'vue'
import { esErrorApi, mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { Ingreso } from '../services/servicioAcceso'
import { TIPOS_ERROR_ACCESO } from '../tipos'

export function usePersonasDentro(
  sedeId: Ref<number | null | undefined>,
  opciones?: { alModificar?: () => void },
) {
  const servicioAcceso = useServicios().acceso

  const personas = ref<Ingreso[]>([])
  const cargando = ref(false)
  const error = ref<string | null>(null)
  const egresandoId = ref<number | null>(null)
  const mensajeAccion = ref<{ tipo: 'exito' | 'error' | 'aviso'; texto: string } | null>(null)

  let controlador: AbortController | undefined

  async function cargar() {
    const idSede = sedeId.value
    if (!idSede) {
      personas.value = []
      error.value = null
      return
    }

    controlador?.abort()
    controlador = new AbortController()

    cargando.value = true
    error.value = null

    try {
      const respuesta = await servicioAcceso.listarIngresos(
        {
          sedeId: idSede,
          dentro: true,
          perPage: 100,
        },
        controlador.signal,
      )
      personas.value = respuesta.items
    } catch (e) {
      if (controlador.signal.aborted) return
      error.value = mensajeDeError(e, 'No se pudo cargar la lista de personas dentro de la sede.')
    } finally {
      cargando.value = false
    }
  }

  async function registrarEgreso(ingresoId: number) {
    egresandoId.value = ingresoId
    mensajeAccion.value = null

    try {
      await servicioAcceso.registrarEgreso(ingresoId)
      mensajeAccion.value = {
        tipo: 'exito',
        texto: 'Egreso registrado correctamente.',
      }
      // Actualizar la lista local quitando a la persona
      personas.value = personas.value.filter((p) => p.id !== ingresoId)
      opciones?.alModificar?.()
    } catch (e) {
      if (esErrorApi(e)) {
        if (e.problema?.type === TIPOS_ERROR_ACCESO.EGRESO_DUPLICADO || e.status === 409) {
          mensajeAccion.value = {
            tipo: 'aviso',
            texto: 'El egreso ya había sido registrado por otra terminal. Lista actualizada.',
          }
          await cargar()
          opciones?.alModificar?.()
          return
        }
      }
      mensajeAccion.value = {
        tipo: 'error',
        texto: mensajeDeError(e, 'No se pudo registrar el egreso.'),
      }
    } finally {
      egresandoId.value = null
    }
  }

  watch(
    () => sedeId.value,
    (nuevoId) => {
      mensajeAccion.value = null
      if (nuevoId) {
        void cargar()
      } else {
        personas.value = []
      }
    },
    { immediate: true },
  )

  const cantidadDentro = computed(() => personas.value.length)

  return {
    personas,
    cargando,
    error,
    egresandoId,
    mensajeAccion,
    cantidadDentro,
    recargar: cargar,
    registrarEgreso,
  }
}
