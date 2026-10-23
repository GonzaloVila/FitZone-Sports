import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { esErrorApi, mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { FiltrosUsuarios, Usuario } from '@/features/usuarios/services/servicioUsuarios'
import { PLANES } from '../presentacion'

export type ModoUsuario = 'existente' | 'nuevo'

type Campo = 'dni' | 'nombre' | 'email' | 'contrasenia' | 'telefono' | 'usuario' | 'sede' | 'plan'

const ESPERA_BUSQUEDA_MS = 300
const MINIMO_BUSQUEDA = 2
const RESULTADOS_POR_BUSQUEDA = 10

// Validación de ayuda para el usuario: la validación real la hace el backend.
const FORMATO_DNI = /^\d{7,20}$/
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LARGO_MINIMO_CONTRASENIA = 8

// Nombre de la propiedad del contrato (en los 422 y en los 409) -> campo del formulario.
const CAMPOS_DEL_CONTRATO: Record<string, Campo> = {
  dni: 'dni',
  nombre: 'nombre',
  email: 'email',
  contrasenia: 'contrasenia',
  telefono: 'telefono',
  usuarioId: 'usuario',
  sedeOrigenId: 'sede',
  plan: 'plan',
}

export function useAltaSocio() {
  const servicios = useServicios()

  const modo = ref<ModoUsuario>('existente')

  // ---- Paso A: elegir usuario ----
  const busqueda = ref('')
  const textoAplicado = ref('')
  const resultados = ref<Usuario[]>([])
  const hayMasResultados = ref(false)
  const buscando = ref(false)
  const busquedaHecha = ref(false)
  const errorBusqueda = ref<string | null>(null)
  const seleccionado = ref<Usuario | null>(null)
  // true si el usuario seleccionado lo creó este formulario (para avisarlo y no recrearlo al reintentar).
  const creadoAhora = ref(false)

  const datosNuevo = reactive({ dni: '', nombre: '', email: '', contrasenia: '', telefono: '' })

  // ---- Paso B: membresía ----
  const sede = ref('')
  const plan = ref('')

  // ---- Envío ----
  const enviando = ref(false)
  const intentado = ref(false)
  const errorGeneral = ref<string | null>(null)
  const erroresServidor = reactive<Partial<Record<Campo, string>>>({})
  let desmontado = false

  // ---- Búsqueda de usuarios existentes (con debounce y descarte de respuestas viejas) ----
  let temporizador: ReturnType<typeof setTimeout> | undefined
  watch(busqueda, (texto) => {
    clearTimeout(temporizador)
    temporizador = setTimeout(() => {
      textoAplicado.value = texto.trim()
    }, ESPERA_BUSQUEDA_MS)
  })

  let ultimaBusqueda = 0
  let controlador: AbortController | undefined

  async function buscar() {
    const numero = ++ultimaBusqueda
    controlador?.abort()
    controlador = new AbortController()
    const texto = textoAplicado.value

    errorBusqueda.value = null
    if (texto.length < MINIMO_BUSQUEDA) {
      resultados.value = []
      hayMasResultados.value = false
      busquedaHecha.value = false
      buscando.value = false
      return
    }

    buscando.value = true
    // Solo usuarios EXTERNO: un SOCIO ya es socio. El contrato filtra por email exacto o por nombre parcial.
    const filtros: FiltrosUsuarios = texto.includes('@') ? { rol: 'EXTERNO', email: texto } : { rol: 'EXTERNO', nombre: texto }
    try {
      const lista = await servicios.usuarios.listar(filtros, 1, RESULTADOS_POR_BUSQUEDA, controlador.signal)
      if (numero !== ultimaBusqueda) return
      resultados.value = lista.items
      hayMasResultados.value = lista.total > lista.items.length
      busquedaHecha.value = true
    } catch (e) {
      if (numero !== ultimaBusqueda) return
      resultados.value = []
      hayMasResultados.value = false
      errorBusqueda.value = mensajeDeError(e, 'No se pudo buscar usuarios.')
    } finally {
      if (numero === ultimaBusqueda) buscando.value = false
    }
  }
  watch(textoAplicado, () => void buscar())

  function seleccionar(usuario: Usuario) {
    seleccionado.value = usuario
    creadoAhora.value = false
    delete erroresServidor.usuario
  }

  function quitarSeleccion() {
    seleccionado.value = null
    creadoAhora.value = false
  }

  // ---- Validación de ayuda ----
  const erroresDeAyuda = computed<Partial<Record<Campo, string>>>(() => {
    if (!intentado.value) return {}
    const errores: Partial<Record<Campo, string>> = {}
    if (modo.value === 'existente') {
      if (!seleccionado.value) errores.usuario = 'Elegí un usuario.'
    } else {
      if (!FORMATO_DNI.test(datosNuevo.dni.trim())) errores.dni = 'El DNI tiene entre 7 y 20 dígitos, sin puntos ni espacios.'
      if (!datosNuevo.nombre.trim()) errores.nombre = 'Ingresá el nombre.'
      if (!FORMATO_EMAIL.test(datosNuevo.email.trim())) errores.email = 'Ingresá un email válido.'
      if (datosNuevo.contrasenia.length < LARGO_MINIMO_CONTRASENIA) {
        errores.contrasenia = `La contraseña tiene al menos ${LARGO_MINIMO_CONTRASENIA} caracteres.`
      }
    }
    if (!sede.value) errores.sede = 'Elegí la sede de origen.'
    if (!PLANES.some((valor) => valor === plan.value)) errores.plan = 'Elegí un plan.'
    return errores
  })

  // Un error del servidor tiene prioridad sobre la ayuda, y se borra cuando el usuario corrige el campo.
  const errores = computed<Partial<Record<Campo, string>>>(() => ({ ...erroresDeAyuda.value, ...erroresServidor }))

  const camposEditables = ['dni', 'nombre', 'email', 'contrasenia', 'telefono'] as const
  for (const campo of camposEditables) {
    watch(
      () => datosNuevo[campo],
      () => delete erroresServidor[campo],
    )
  }
  watch(sede, () => delete erroresServidor.sede)
  watch(plan, () => delete erroresServidor.plan)

  // Reparte los errores del contrato: 409 nombra el campo en `detail`; 422 trae `errors` ("campo must be ...").
  function repartirErrores(e: unknown, porDefecto: string) {
    if (!esErrorApi(e)) {
      errorGeneral.value = porDefecto
      return
    }
    const sinCampo: string[] = []
    if (e.status === 409) {
      const detalle = e.message.toLowerCase()
      const campo: Campo | null = detalle.includes('email') ? 'email' : detalle.includes('dni') ? 'dni' : null
      if (campo && modo.value === 'nuevo') erroresServidor[campo] = e.message
      else sinCampo.push(e.message)
    } else if (e.status === 422 && e.problema?.errors?.length) {
      for (const mensaje of e.problema.errors) {
        const campo = CAMPOS_DEL_CONTRATO[mensaje.split(' ')[0] ?? '']
        if (campo) erroresServidor[campo] = mensaje
        else sinCampo.push(mensaje)
      }
    } else {
      sinCampo.push(e.message)
    }
    errorGeneral.value = sinCampo.length ? sinCampo.join(' ') : 'Revisá los datos marcados.'
  }

  // Devuelve el id del socio creado, o null si no se pudo (el error queda en el estado).
  async function enviar(): Promise<number | null> {
    if (enviando.value) return null
    intentado.value = true
    errorGeneral.value = null
    for (const campo of Object.keys(erroresServidor) as Campo[]) delete erroresServidor[campo]
    if (Object.keys(erroresDeAyuda.value).length > 0) return null

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
          if (!desmontado) repartirErrores(e, 'No se pudo crear el usuario.')
          return null
        } finally {
          // La contraseña no se conserva fuera de este envío, haya salido bien o mal.
          datosNuevo.contrasenia = ''
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
        return desmontado ? null : socio.id
      } catch (e) {
        if (!desmontado) {
          repartirErrores(e, 'No se pudo dar de alta al socio.')
          if (creadoAhora.value) {
            errorGeneral.value = `El usuario ya se creó, pero no se pudo dar de alta como socio. ${errorGeneral.value} Podés reintentar sin volver a crearlo.`
          }
        }
        return null
      }
    } finally {
      enviando.value = false
    }
  }

  onScopeDispose(() => {
    desmontado = true
    clearTimeout(temporizador)
    ultimaBusqueda++
    controlador?.abort()
    datosNuevo.contrasenia = ''
  })

  return {
    modo,
    busqueda,
    resultados,
    hayMasResultados,
    buscando,
    busquedaHecha,
    errorBusqueda,
    seleccionado,
    creadoAhora,
    datosNuevo,
    sede,
    plan,
    enviando,
    errores,
    errorGeneral,
    seleccionar,
    quitarSeleccion,
    enviar,
  }
}
