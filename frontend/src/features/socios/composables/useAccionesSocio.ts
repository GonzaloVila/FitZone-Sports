import { computed, ref } from 'vue'
import { useServicios } from '@/compartido/servicios'
import { useAvisosFz } from '@/ui'
import {
  ETIQUETAS_PLAN,
  accionPermitida,
  cambiosParaPlan,
  mensajeDeErrorDeMembresia,
  puedeConfirmarPlan,
} from '../presentacion'
import type { EstadoMembresia, Membresia, MembresiaPatch, Plan } from '../services/servicioSocios'
import type { AccionConModal, FilaSocio } from '../tipos'

export interface PedidoAccion {
  accion: AccionConModal
  fila: FilaSocio
}

// Lo que recibe quien llamó cuando una acción terminó bien.
export type ResultadoAccion = { socioId: number; membresia: Membresia } | { socioId: number; baja: true }

interface Exito {
  resultado: ResultadoAccion
  titulo: string
  descripcion: string
}

const ERROR_POR_DEFECTO = 'No se pudo completar la acción.'

// Acciones con modal sobre una fila de la lista: cambiar plan (o renovar), suspender, reactivar y dejar de ser socio.
// El modal queda abierto si falla (el error se muestra adentro); si sale bien se cierra, avisa y llama a `alTerminar`.
export function useAccionesSocio(alTerminar: (resultado: ResultadoAccion) => void) {
  const servicio = useServicios().socios
  const avisos = useAvisosFz()

  const pedido = ref<PedidoAccion | null>(null)
  const ejecutando = ref(false)
  const error = ref<string | null>(null)

  const accion = computed(() => pedido.value?.accion ?? null)
  const socio = computed(() => pedido.value?.fila.socio ?? null)
  const membresia = computed(() => {
    const fila = pedido.value?.fila
    return fila?.membresia.situacion === 'disponible' ? fila.membresia.membresia : null
  })

  // Cada apertura y cada cierre avanzan el número: una respuesta que vuelve con otro número es de un pedido que ya
  // no está en pantalla (se cerró o se abrió otro) y se descarta.
  let version = 0

  function abrir(fila: FilaSocio, nueva: AccionConModal) {
    version++
    ejecutando.value = false
    error.value = null
    pedido.value = { accion: nueva, fila }
  }

  function cerrar() {
    version++
    ejecutando.value = false
    error.value = null
    pedido.value = null
  }

  // Sin doble disparo: mientras hay una acción en curso no se ejecuta otra.
  async function ejecutar(esperada: AccionConModal, tarea: (socioId: number) => Promise<Exito>) {
    const actual = pedido.value
    if (!actual || actual.accion !== esperada || ejecutando.value) return
    const mia = version
    ejecutando.value = true
    error.value = null
    try {
      const exito = await tarea(actual.fila.socio.id)
      if (mia !== version) return
      pedido.value = null
      avisos.exito(exito.titulo, exito.descripcion)
      alTerminar(exito.resultado)
    } catch (e) {
      if (mia === version) error.value = mensajeDeErrorDeMembresia(e, ERROR_POR_DEFECTO)
    } finally {
      if (mia === version) ejecutando.value = false
    }
  }

  function cambiarMembresia(esperada: AccionConModal, cambios: MembresiaPatch, titulo: string, descripcion: string) {
    return ejecutar(esperada, async (socioId) => ({
      resultado: { socioId, membresia: await servicio.modificarMembresia(socioId, cambios) },
      titulo,
      descripcion,
    }))
  }

  function confirmarPlan(plan: Plan) {
    const estado: EstadoMembresia | null = membresia.value?.estado ?? null
    const nombre = socio.value?.nombre ?? ''
    if (!puedeConfirmarPlan(estado, membresia.value?.plan ?? null, plan)) return Promise.resolve()
    const renueva = estado === 'VENCIDA'
    return cambiarMembresia(
      'cambiar-plan',
      cambiosParaPlan(plan, estado),
      renueva ? 'Membresía renovada' : 'Plan cambiado',
      renueva ? `${nombre} tiene el plan ${ETIQUETAS_PLAN[plan]} desde hoy.` : `${nombre} ahora tiene el plan ${ETIQUETAS_PLAN[plan]}.`,
    )
  }

  function suspender() {
    if (!accionPermitida('suspender', membresia.value?.estado ?? null)) return Promise.resolve()
    return cambiarMembresia('suspender', { estado: 'SUSPENDIDA' }, 'Membresía suspendida', `${socio.value?.nombre}.`)
  }

  function reactivar() {
    if (!accionPermitida('reactivar', membresia.value?.estado ?? null)) return Promise.resolve()
    return cambiarMembresia('reactivar', { estado: 'ACTIVA' }, 'Membresía reactivada', `${socio.value?.nombre}.`)
  }

  function dejarDeSerSocio() {
    const nombre = socio.value?.nombre ?? ''
    return ejecutar('dejar-de-ser-socio', async (socioId) => {
      await servicio.dejarDeSerSocio(socioId)
      return {
        resultado: { socioId, baja: true },
        titulo: 'Dejó de ser socio',
        descripcion: `${nombre} ya no es socio.`,
      }
    })
  }

  return { pedido, accion, socio, membresia, ejecutando, error, abrir, cerrar, confirmarPlan, suspender, reactivar, dejarDeSerSocio }
}
