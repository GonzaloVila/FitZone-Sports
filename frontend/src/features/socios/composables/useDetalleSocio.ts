import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { esErrorApiConEstado, mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { Usuario } from '@/features/usuarios/services/servicioUsuarios'
import { useAvisosFz } from '@/ui'
import type { Membresia, Socio } from '../services/servicioSocios'
import { mensajeDeErrorDeMembresia } from '../presentacion'
import type { AccionSocio, Opcional } from '../tipos'

export type EstadoDetalle = 'cargando' | 'listo' | 'no-existe' | 'error'

interface ResultadoAccion {
  // Aviso flotante de éxito (sin mensaje, la acción termina en silencio: se ve en la pantalla).
  mensaje?: string
  // Actualiza el estado local con la respuesta del servidor; solo corre si la carga sigue vigente.
  aplicar: () => void
}

// `socioId` es null cuando el id de la ruta no es un entero positivo: se trata como socio inexistente sin pedir nada.
// Las acciones con modal (cambiar plan, suspender, reactivar, dejar de ser socio) las maneja useAccionesSocio; acá
// quedan las que no lo usan: la renovación automática y el cambio de sede.
export function useDetalleSocio(socioId: MaybeRefOrGetter<number | null>) {
  const servicios = useServicios()
  const avisos = useAvisosFz()

  const estado = ref<EstadoDetalle>('cargando')
  const error = ref<string | null>(null)
  const socio = ref<Socio | null>(null)
  const membresia = ref<Opcional<Membresia>>({ situacion: 'cargando' })
  const usuario = ref<Opcional<Usuario>>({ situacion: 'cargando' })

  const ejecutando = ref<AccionSocio | null>(null)
  // Error de la última acción que se muestra dentro de su modal (la renovación automática avisa con un aviso flotante).
  const errorAccion = ref<string | null>(null)

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

  // Muestra la membresía que devolvió el servidor tras una acción hecha por fuera de este composable (los modales).
  function reemplazarMembresia(actualizada: Membresia) {
    if (estado.value === 'listo') membresia.value = { situacion: 'disponible', valor: actualizada }
  }

  // ---- Acciones ----
  // Sin doble disparo: mientras hay una acción en curso no se ejecuta otra. Devuelve true si salió bien.
  // El error va a `errorAccion` (para el modal) o, con `flotante`, a un aviso flotante.
  async function ejecutar(
    accion: AccionSocio,
    tarea: (id: number) => Promise<ResultadoAccion>,
    flotante = false,
  ): Promise<boolean> {
    const id = toValue(socioId)
    if (ejecutando.value || id === null || estado.value !== 'listo') return false
    const carga = ultimaCarga
    ejecutando.value = accion
    errorAccion.value = null
    try {
      const { mensaje, aplicar } = await tarea(id)
      // Si mientras tanto se cambió de socio o se salió de la página, el resultado ya no aplica.
      if (carga !== ultimaCarga) return false
      aplicar()
      if (mensaje) avisos.exito(mensaje)
      return true
    } catch (e) {
      if (carga === ultimaCarga) {
        const mensaje = mensajeDeErrorDeMembresia(e, 'No se pudo completar la acción.')
        if (flotante) avisos.error(mensaje)
        else errorAccion.value = mensaje
      }
      return false
    } finally {
      if (carga === ultimaCarga) ejecutando.value = null
    }
  }

  // Se guarda al tocar el interruptor; si falla, la membresía no cambia y sale un aviso flotante.
  function alternarRenovacion() {
    if (membresia.value.situacion !== 'disponible') return Promise.resolve(false)
    const activar = !membresia.value.valor.renuevaAutomatica
    return ejecutar(
      'renovacion-automatica',
      async (id) => {
        const actualizada = await servicios.socios.modificarMembresia(id, { renuevaAutomatica: activar })
        return { aplicar: () => reemplazarMembresia(actualizada) }
      },
      true,
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
    reemplazarMembresia,
    alternarRenovacion,
    cambiarSede,
    limpiarErrorAccion,
  }
}
