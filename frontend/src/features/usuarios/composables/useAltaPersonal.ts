import { computed, onScopeDispose, reactive, ref, toValue, watch, type MaybeRefOrGetter, type UnwrapNestedRefs } from 'vue'
import { useServicios } from '@/compartido/servicios'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import type { Usuario } from '../services/servicioUsuarios'
import {
  datosPersonalVacios,
  erroresDeDatos,
  hayErrores,
  repartirErroresPersonal,
  type CampoPersonal,
  type DatosPersonal,
  type ErroresPersonal,
} from '../validacionPersonal'

// Alta de un recepcionista. La sede es obligatoria y se ofrecen únicamente las
// libres: EmpleadoSede.sede_id es único, así que una sede ya ocupada daría 409.
export function useAltaPersonal(sedes: MaybeRefOrGetter<readonly Sede[]>) {
  const servicio = useServicios().usuarios

  const datos = reactive<DatosPersonal>(datosPersonalVacios())
  const intentado = ref(false)
  const enviando = ref(false)
  const errorGeneral = ref<string | null>(null)
  const erroresServidor = reactive<ErroresPersonal>({})

  const sedesOcupadas = ref<Set<number>>(new Set())
  const cargandoSedes = ref(false)
  const contraseniaBorrada = ref(false)
  let desmontado = false
  let consultaSedes = 0

  const sedesDisponibles = computed(() =>
    toValue(sedes).filter((sede) => !sedesOcupadas.value.has(sede.id)),
  )

  // La lista de sedes libres se pide cada vez que se abre el modal: otra
  // pestaña pudo haber asignado una sede mientras tanto.
  async function cargarSedesOcupadas() {
    const consulta = ++consultaSedes
    cargandoSedes.value = true
    try {
      const recepcionistas = await servicio.listarTodosPorRol('RECEPCION')
      if (desmontado || consulta !== consultaSedes) return
      sedesOcupadas.value = new Set(
        recepcionistas
          .map((usuario) => usuario.sedeId)
          .filter((sedeId): sedeId is number => typeof sedeId === 'number'),
      )
    } catch {
      // Sin aviso: si falla, se muestran todas y el backend sigue validando la
      // sede (409 legible junto al campo).
      if (!desmontado && consulta === consultaSedes) sedesOcupadas.value = new Set()
    } finally {
      if (!desmontado && consulta === consultaSedes) cargandoSedes.value = false
    }
  }

  // Si la sede elegida deja de estar libre (la ocuparon desde otra pestaña),
  // se limpia para no mandar un valor que ya no está en el select.
  watch(sedesDisponibles, (lista) => {
    if (datos.sedeId && !lista.some((sede) => String(sede.id) === datos.sedeId)) datos.sedeId = ''
  })

  const erroresDeAyuda = computed<ErroresPersonal>(() => {
    const errores = intentado.value ? erroresDeDatos(datos) : {}
    // La contraseña se vacía sola después de cada envío; ese vacío no lo causó
    // la persona, así que no se marca hasta que vuelva a intentar.
    if (contraseniaBorrada.value && datos.contrasenia === '') delete errores.contrasenia
    return errores
  })

  // Un error del servidor tiene prioridad sobre la ayuda y se borra al corregir el campo.
  const errores = computed<ErroresPersonal>(() => ({ ...erroresDeAyuda.value, ...erroresServidor }))

  for (const campo of ['nombre', 'dni', 'email', 'telefono', 'contrasenia', 'sedeId'] as const) {
    watch(
      () => datos[campo],
      (valor) => {
        if (campo === 'contrasenia') {
          if (valor === '') return
          contraseniaBorrada.value = false
        }
        delete erroresServidor[campo]
      },
    )
  }

  async function crear(): Promise<Usuario | null> {
    if (enviando.value) return null
    intentado.value = true
    contraseniaBorrada.value = false
    errorGeneral.value = null
    for (const campo of Object.keys(erroresServidor) as CampoPersonal[]) delete erroresServidor[campo]
    if (hayErrores(erroresDeAyuda.value)) return null

    enviando.value = true
    try {
      const telefono = datos.telefono.trim()
      const usuario = await servicio.crear({
        rol: 'RECEPCION',
        nombre: datos.nombre.trim(),
        dni: datos.dni.trim(),
        email: datos.email.trim(),
        contrasenia: datos.contrasenia,
        ...(telefono ? { telefono } : {}),
        sedeId: Number(datos.sedeId),
      })
      return desmontado ? null : usuario
    } catch (e) {
      if (!desmontado) {
        const { campos, general } = repartirErroresPersonal(e, 'No se pudo crear el recepcionista.')
        Object.assign(erroresServidor, campos)
        errorGeneral.value = general
      }
      return null
    } finally {
      datos.contrasenia = ''
      contraseniaBorrada.value = true
      enviando.value = false
    }
  }

  function reiniciar() {
    Object.assign(datos, datosPersonalVacios())
    intentado.value = false
    contraseniaBorrada.value = false
    enviando.value = false
    errorGeneral.value = null
    for (const campo of Object.keys(erroresServidor) as CampoPersonal[]) delete erroresServidor[campo]
    consultaSedes++
    cargandoSedes.value = false
  }

  onScopeDispose(() => {
    desmontado = true
    consultaSedes++
    datos.contrasenia = ''
  })

  return {
    datos,
    sedesDisponibles,
    cargandoSedes,
    enviando,
    errores,
    errorGeneral,
    crear,
    reiniciar,
    cargarSedesOcupadas,
  }
}

// El estado del alta tal como lo ve el formulario: el modal lo envuelve con
// `reactive`, que desenvuelve los refs, y se lo pasa a los campos.
export type AltaPersonal = UnwrapNestedRefs<ReturnType<typeof useAltaPersonal>>
