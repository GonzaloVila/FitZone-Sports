import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { esErrorApiConEstado, mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { Usuario } from '@/features/usuarios/services/servicioUsuarios'
import type { Membresia, MembresiaPatch, Plan, Socio } from '../services/servicioSocios'
import { accionPermitida, cambiosParaPlan, mensajeDeErrorDeMembresia } from '../presentacion'
import type { AccionSocio, Opcional } from '../tipos'

export type EstadoDetalle = 'cargando' | 'listo' | 'no-existe' | 'error'

interface ResultadoAccion {
  mensaje: string
  // Actualiza el estado local con la respuesta del servidor; solo corre si la carga sigue vigente.
  aplicar?: () => void
}

// `socioId` es null cuando el id de la ruta no es un entero positivo: se trata como socio inexistente sin pedir nada.
export function useDetalleSocio(socioId: MaybeRefOrGetter<number | null>) {
  const servicios = useServicios()

  const estado = ref<EstadoDetalle>('cargando')
  const error = ref<string | null>(null)
  const socio = ref<Socio | null>(null)
  const membresia = ref<Opcional<Membresia>>({ situacion: 'cargando' })
  const usuario = ref<Opcional<Usuario>>({ situacion: 'cargando' })

  const ejecutando = ref<AccionSocio | null>(null)
  const errorAccion = ref<string | null>(null)
  const exito = ref<string | null>(null)

  // Descarte de respuestas viejas: cada carga tiene un número y su propio AbortController.
  // Al cambiar el id o salir de la página el número avanza y todo lo pendiente queda descartado.
  let ultimaCarga = 0
  let controlador: AbortController | undefined

  async function cargar() {
    const carga = ++ultimaCarga
    controlador?.abort()
    controlador = new AbortController()
    const { signal } = controlador
    const id = toValue(socioId)

    socio.value = null
    membresia.value = { situacion: 'cargando' }
    usuario.value = { situacion: 'cargando' }
    ejecutando.value = null
    errorAccion.value = null
    exito.value = null
    error.value = null

    if (id === null) {
      estado.value = 'no-existe'
      return
    }
    estado.value = 'cargando'

    // El socio y su membresía se piden en paralelo; el usuario, apenas se conoce su id (sale del socio).
    const promesaMembresia = servicios.socios.obtenerMembresia(id, signal).then(
      (valor): Opcional<Membresia> => ({ situacion: 'disponible', valor }),
      (): Opcional<Membresia> => ({ situacion: 'no-disponible' }),
    )

    try {
      const encontrado = await servicios.socios.obtener(id, signal)
      if (carga !== ultimaCarga) return
      socio.value = encontrado
      estado.value = 'listo'

      const promesaUsuario = servicios.usuarios.obtener(encontrado.usuarioId, signal).then(
        (valor): Opcional<Usuario> => ({ situacion: 'disponible', valor }),
        (): Opcional<Usuario> => ({ situacion: 'no-disponible' }),
      )
      const [datosMembresia, datosUsuario] = await Promise.all([promesaMembresia, promesaUsuario])
      if (carga !== ultimaCarga) return
      membresia.value = datosMembresia
      usuario.value = datosUsuario
    } catch (e) {
      if (carga !== ultimaCarga) return
      if (esErrorApiConEstado(e, 404)) {
        estado.value = 'no-existe'
      } else {
        estado.value = 'error'
        error.value = mensajeDeError(e, 'No se pudo cargar el socio.')
      }
    }
  }

  // ---- Acciones ----
  const estadoMembresia = computed(() =>
    membresia.value.situacion === 'disponible' ? membresia.value.valor.estado : null,
  )
  const hayMembresia = computed(() => membresia.value.situacion === 'disponible')
  // Las reglas viven en presentacion.ts: la lista de socios usa las mismas.
  const puedeSuspender = computed(() => accionPermitida('suspender', estadoMembresia.value))
  const puedeReactivar = computed(() => accionPermitida('reactivar', estadoMembresia.value))

  // Sin doble disparo: mientras hay una acción en curso no se ejecuta otra. Devuelve true si salió bien.
  async function ejecutar(accion: AccionSocio, tarea: (id: number) => Promise<ResultadoAccion>): Promise<boolean> {
    const id = toValue(socioId)
    if (ejecutando.value || id === null || estado.value !== 'listo') return false
    const carga = ultimaCarga
    ejecutando.value = accion
    errorAccion.value = null
    exito.value = null
    try {
      const { mensaje, aplicar } = await tarea(id)
      // Si mientras tanto se cambió de socio o se salió de la página, el resultado ya no aplica.
      if (carga !== ultimaCarga) return false
      aplicar?.()
      exito.value = mensaje
      return true
    } catch (e) {
      if (carga === ultimaCarga) errorAccion.value = mensajeDeErrorDeMembresia(e, 'No se pudo completar la acción.')
      return false
    } finally {
      if (carga === ultimaCarga) ejecutando.value = null
    }
  }

  function cambiarMembresia(accion: AccionSocio, cambios: MembresiaPatch, mensaje: string) {
    return ejecutar(accion, async (id) => {
      const actualizada = await servicios.socios.modificarMembresia(id, cambios)
      return {
        mensaje,
        aplicar: () => {
          membresia.value = { situacion: 'disponible', valor: actualizada }
        },
      }
    })
  }

  const suspender = () => cambiarMembresia('suspender', { estado: 'SUSPENDIDA' }, 'La membresía quedó suspendida.')
  const reactivar = () => cambiarMembresia('reactivar', { estado: 'ACTIVA' }, 'La membresía volvió a estar activa.')
  // Una VENCIDA se renueva (se cobra el plan nuevo y vuelve a estar activa); una ACTIVA cambia sin cobro.
  const cambiarPlan = (plan: Plan) => {
    const vencida = estadoMembresia.value === 'VENCIDA'
    return cambiarMembresia(
      'cambiar-plan',
      cambiosParaPlan(plan, estadoMembresia.value),
      vencida ? 'La membresía se renovó con el plan nuevo desde hoy.' : 'Se cambió el plan y se abrió un período nuevo desde hoy.',
    )
  }

  function alternarRenovacion() {
    if (membresia.value.situacion !== 'disponible') return Promise.resolve(false)
    const activar = !membresia.value.valor.renuevaAutomatica
    return cambiarMembresia(
      'renovacion-automatica',
      { renuevaAutomatica: activar },
      activar ? 'Se activó la renovación automática.' : 'Se desactivó la renovación automática.',
    )
  }

  function cambiarSede(sedeOrigenId: number) {
    return ejecutar('cambiar-sede', async (id) => {
      const actualizado = await servicios.socios.modificar(id, { sedeOrigenId })
      return {
        mensaje: 'Se cambió la sede de origen.',
        aplicar: () => {
          socio.value = actualizado
        },
      }
    })
  }

  // true si el socio dejó de serlo: la página navega a la lista.
  function dejarDeSerSocio() {
    return ejecutar('dejar-de-ser-socio', async (id) => {
      await servicios.socios.dejarDeSerSocio(id)
      return { mensaje: 'El socio dejó de serlo.' }
    })
  }

  function limpiarErrorAccion() {
    errorAccion.value = null
  }

  watch(
    () => toValue(socioId),
    () => void cargar(),
  )
  onScopeDispose(() => {
    ultimaCarga++
    controlador?.abort()
  })

  void cargar()

  return {
    estado,
    error,
    socio,
    membresia,
    usuario,
    ejecutando,
    errorAccion,
    exito,
    puedeSuspender,
    puedeReactivar,
    hayMembresia,
    suspender,
    reactivar,
    cambiarPlan,
    alternarRenovacion,
    cambiarSede,
    dejarDeSerSocio,
    limpiarErrorAccion,
  }
}
