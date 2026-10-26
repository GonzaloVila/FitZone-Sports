import { computed, onScopeDispose, reactive, ref, watch, type UnwrapNestedRefs } from 'vue'
import { useServicios } from '@/compartido/servicios'
import type { Usuario } from '@/features/usuarios/services/servicioUsuarios'
import { PLANES } from '../presentacion'
import type { Socio } from '../services/servicioSocios'
import {
  datosUsuarioVacios,
  erroresDeDatos,
  erroresDePlan,
  hayErrores,
  pasoConErrores,
  repartirErroresAlta,
  type CampoAlta,
  type ErroresAlta,
  type ModoUsuario,
  type PasoAlta,
} from '../validacionAlta'
import { useBusquedaUsuarios } from './useBusquedaUsuarios'

export type { ModoUsuario, PasoAlta } from '../validacionAlta'

// El alta de un socio en dos pasos: 1) el usuario (nuevo o ya existente) y la sede; 2) el plan de la membresía.
export function useAltaSocio() {
  const servicios = useServicios()
  const busqueda = useBusquedaUsuarios()

  const paso = ref<PasoAlta>('datos')
  const modo = ref<ModoUsuario>('nuevo')
  // Lo escrito en cada modo se conserva al cambiar de uno al otro.
  const datosNuevo = reactive(datosUsuarioVacios())
  const seleccionado = ref<Usuario | null>(null)
  // true si el usuario seleccionado lo creó este formulario (para avisarlo y no recrearlo al reintentar).
  const creadoAhora = ref(false)
  const sede = ref('')
  const plan = ref('')

  const enviando = ref(false)
  // Los errores de ayuda de un paso aparecen recién cuando se intentó avanzar o enviar.
  const intentadoDatos = ref(false)
  const intentadoPlan = ref(false)
  const errorGeneral = ref<string | null>(null)
  const erroresServidor = reactive<ErroresAlta>({})
  let desmontado = false

  const nombreDelSocio = computed(() => (modo.value === 'existente' ? seleccionado.value?.nombre : datosNuevo.nombre.trim()) ?? '')

  function seleccionar(usuario: Usuario) {
    seleccionado.value = usuario
    creadoAhora.value = false
    delete erroresServidor.usuario
  }

  function quitarSeleccion() {
    seleccionado.value = null
    creadoAhora.value = false
  }

  const erroresDeAyudaDatos = computed(() =>
    erroresDeDatos({ modo: modo.value, datos: datosNuevo, hayUsuario: seleccionado.value !== null, sede: sede.value }),
  )
  // La contraseña se vacía sola después de cada envío. Ese vacío no lo causó la persona: no se marca como error
  // (solo se ve la ayuda neutra) hasta que vuelva a intentar continuar o enviar, o escriba algo en el campo.
  const contraseniaBorrada = ref(false)
  const erroresDeAyuda = computed<ErroresAlta>(() => {
    const errores: ErroresAlta = {
      ...(intentadoDatos.value ? erroresDeAyudaDatos.value : {}),
      ...(intentadoPlan.value ? erroresDePlan(plan.value) : {}),
    }
    if (contraseniaBorrada.value && datosNuevo.contrasenia === '') delete errores.contrasenia
    return errores
  })

  // Un error del servidor tiene prioridad sobre la ayuda, y se borra cuando el usuario corrige el campo.
  const errores = computed<ErroresAlta>(() => ({ ...erroresDeAyuda.value, ...erroresServidor }))

  for (const campo of ['dni', 'nombre', 'email', 'contrasenia', 'telefono'] as const) {
    watch(
      () => datosNuevo[campo],
      (valor) => {
        if (campo === 'contrasenia') {
          // Vaciarla por código tras el envío no es "corregir" el campo: el error del servidor sobre ella sigue a la vista.
          if (valor === '') return
          contraseniaBorrada.value = false
        }
        delete erroresServidor[campo]
      },
    )
  }
  watch(sede, () => delete erroresServidor.sede)
  watch(plan, () => delete erroresServidor.plan)

  // "Continuar al plan": valida el paso 1 y avanza solo si está bien. Devuelve si avanzó.
  function continuar(): boolean {
    intentadoDatos.value = true
    contraseniaBorrada.value = false
    errorGeneral.value = null
    // Un error del servidor sobre un campo del paso 1 sigue vigente hasta que se corrige ese campo.
    if (hayErrores(erroresDeAyudaDatos.value) || pasoConErrores(erroresServidor) === 'datos') return false
    paso.value = 'plan'
    return true
  }

  // Volver al paso 1 es libre y no pierde nada de lo cargado.
  function volver() {
    paso.value = 'datos'
  }

  // Las pestañas piden un paso: el 2 pasa por la misma validación que "Continuar", el 1 siempre se puede.
  function irAPaso(destino: PasoAlta) {
    if (destino === 'plan') continuar()
    else volver()
  }

  function mostrarErrores(e: unknown, porDefecto: string) {
    const { campos, general } = repartirErroresAlta(e, modo.value, porDefecto)
    Object.assign(erroresServidor, campos)
    errorGeneral.value = general
    // Si el servidor objetó algo del paso 1, el modal vuelve ahí para que se vea junto al campo.
    if (pasoConErrores(campos) === 'datos') paso.value = 'datos'
  }

  // Devuelve el socio creado, o null si no se pudo (el error queda en el estado).
  async function enviar(): Promise<Socio | null> {
    if (enviando.value) return null
    intentadoDatos.value = true
    contraseniaBorrada.value = false
    errorGeneral.value = null
    for (const campo of Object.keys(erroresServidor) as CampoAlta[]) delete erroresServidor[campo]
    if (hayErrores(erroresDeAyudaDatos.value)) {
      paso.value = 'datos'
      return null
    }
    intentadoPlan.value = true
    const planElegido = PLANES.find((valor) => valor === plan.value)
    if (!planElegido) return null

    enviando.value = true
    try {
      let usuario = seleccionado.value
      if (modo.value === 'nuevo') {
        try {
          const telefono = datosNuevo.telefono.trim()
          usuario = await servicios.usuarios.crear({
            rol: 'EXTERNO',
            dni: datosNuevo.dni.trim(),
            nombre: datosNuevo.nombre.trim(),
            email: datosNuevo.email.trim(),
            contrasenia: datosNuevo.contrasenia,
            ...(telefono ? { telefono } : {}),
          })
        } catch (e) {
          if (!desmontado) mostrarErrores(e, 'No se pudo crear el usuario.')
          return null
        } finally {
          // La contraseña no se conserva fuera de este envío, haya salido bien o mal.
          datosNuevo.contrasenia = ''
          contraseniaBorrada.value = true
        }
        // Desde acá el usuario existe: pasa a ser el seleccionado, así un reintento no lo vuelve a crear.
        seleccionado.value = usuario
        creadoAhora.value = true
        modo.value = 'existente'
      }
      if (!usuario) return null

      try {
        const socio = await servicios.socios.crear({
          usuarioId: usuario.id,
          sedeOrigenId: Number(sede.value),
          plan: planElegido,
        })
        return desmontado ? null : socio
      } catch (e) {
        if (!desmontado) {
          mostrarErrores(e, 'No se pudo dar de alta al socio.')
          if (creadoAhora.value) {
            const motivo = (errorGeneral.value ?? '').trim()
            const motivoConPunto = !motivo || /[.!?]$/.test(motivo) ? motivo : `${motivo}.`
            errorGeneral.value = `El usuario ya se creó, pero no se pudo dar de alta como socio. ${motivoConPunto} Podés reintentar sin volver a crearlo.`
          }
        }
        return null
      }
    } finally {
      enviando.value = false
    }
  }

  // Deja el formulario como recién abierto (el modal lo usa cada vez que se abre).
  function reiniciar() {
    paso.value = 'datos'
    modo.value = 'nuevo'
    Object.assign(datosNuevo, datosUsuarioVacios())
    busqueda.reiniciar()
    seleccionado.value = null
    creadoAhora.value = false
    sede.value = ''
    plan.value = ''
    intentadoDatos.value = false
    intentadoPlan.value = false
    contraseniaBorrada.value = false
    errorGeneral.value = null
    for (const campo of Object.keys(erroresServidor) as CampoAlta[]) delete erroresServidor[campo]
  }

  onScopeDispose(() => {
    desmontado = true
    datosNuevo.contrasenia = ''
  })

  return {
    paso,
    modo,
    datosNuevo,
    busqueda: busqueda.busqueda,
    resultados: busqueda.resultados,
    hayMasResultados: busqueda.hayMasResultados,
    buscando: busqueda.buscando,
    busquedaHecha: busqueda.busquedaHecha,
    errorBusqueda: busqueda.errorBusqueda,
    seleccionado,
    creadoAhora,
    sede,
    plan,
    enviando,
    errores,
    errorGeneral,
    nombreDelSocio,
    seleccionar,
    quitarSeleccion,
    continuar,
    volver,
    irAPaso,
    enviar,
    reiniciar,
  }
}

// El estado del alta tal como lo ven los componentes de los pasos: el modal lo envuelve con `reactive`, que
// desenvuelve los refs, y se los pasa a cada paso.
export type AltaSocio = UnwrapNestedRefs<ReturnType<typeof useAltaSocio>>
