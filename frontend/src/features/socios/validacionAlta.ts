import { esErrorApi } from '@/compartido/http/errores'
import { erroresDe422 } from '@/compartido/erroresFormulario'
import { PLANES } from './presentacion'

export type ModoUsuario = 'existente' | 'nuevo'

// Los dos pasos del alta: los datos del usuario (y la sede) y el plan de la membresía.
export type PasoAlta = 'datos' | 'plan'

export type CampoAlta = 'dni' | 'nombre' | 'email' | 'contrasenia' | 'telefono' | 'usuario' | 'sede' | 'plan'

export type ErroresAlta = Partial<Record<CampoAlta, string>>

export interface DatosUsuarioNuevo {
  dni: string
  nombre: string
  email: string
  contrasenia: string
  telefono: string
}

export const datosUsuarioVacios = (): DatosUsuarioNuevo => ({ dni: '', nombre: '', email: '', contrasenia: '', telefono: '' })

// En qué paso se ve cada campo: un error del servidor sobre un campo del primero devuelve al primero.
const PASO_DEL_CAMPO: Record<CampoAlta, PasoAlta> = {
  dni: 'datos',
  nombre: 'datos',
  email: 'datos',
  contrasenia: 'datos',
  telefono: 'datos',
  usuario: 'datos',
  sede: 'datos',
  plan: 'plan',
}

export const pasoDelCampo = (campo: CampoAlta): PasoAlta => PASO_DEL_CAMPO[campo]

// Validación de ayuda para el usuario: la validación real la hace el backend.
const FORMATO_DNI = /^\d{7,20}$/
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const LARGO_MINIMO_CONTRASENIA = 8

// Nombre de la propiedad del contrato (en los 422 y en los 409) -> campo del formulario.
const CAMPOS_DEL_CONTRATO: Record<string, CampoAlta> = {
  dni: 'dni',
  nombre: 'nombre',
  email: 'email',
  contrasenia: 'contrasenia',
  telefono: 'telefono',
  usuarioId: 'usuario',
  sedeOrigenId: 'sede',
  plan: 'plan',
}

// Un 409 al crear el usuario: el DNI o el correo ya pertenecen a otro.
const MENSAJE_REPETIDO = { email: 'Ya existe un usuario con ese correo.', dni: 'Ya existe un usuario con ese DNI.' } as const

export interface EntradaDatos {
  modo: ModoUsuario
  datos: DatosUsuarioNuevo
  // Hay un usuario existente elegido (solo cuenta en el modo "existente").
  hayUsuario: boolean
  sede: string
}

// Paso 1. Con un usuario nuevo se piden sus datos; con uno existente, haberlo elegido. La sede va en los dos casos.
export function erroresDeDatos({ modo, datos, hayUsuario, sede }: EntradaDatos): ErroresAlta {
  const errores: ErroresAlta = {}
  if (modo === 'existente') {
    if (!hayUsuario) errores.usuario = 'Elegí un usuario.'
  } else {
    if (!FORMATO_DNI.test(datos.dni.trim())) errores.dni = 'El DNI tiene entre 7 y 20 dígitos, sin puntos ni espacios.'
    if (!datos.nombre.trim()) errores.nombre = 'Ingresá el nombre y apellido.'
    if (!FORMATO_EMAIL.test(datos.email.trim())) errores.email = 'Ingresá un correo válido.'
    if (datos.contrasenia.length === 0) {
      errores.contrasenia = 'Ingresá una contraseña.'
    } else if (datos.contrasenia.length < LARGO_MINIMO_CONTRASENIA) {
      errores.contrasenia = `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENIA} caracteres.`
    }
  }
  if (!sede) errores.sede = 'Elegí la sede de origen.'
  return errores
}

// Paso 2.
export function erroresDePlan(plan: string): ErroresAlta {
  return PLANES.some((valor) => valor === plan) ? {} : { plan: 'Elegí un plan.' }
}

export const hayErrores = (errores: ErroresAlta): boolean => Object.keys(errores).length > 0

// Reparte los errores del contrato: un 409 nombra el campo en `detail` (solo cuenta con un usuario nuevo: es el
// único caso en que el DNI o el correo salen del formulario); un 422 trae `errors` por propiedad. Lo que no
// corresponde a un campo es un error general del modal.
export function repartirErroresAlta(e: unknown, modo: ModoUsuario, porDefecto: string): { campos: ErroresAlta; general: string } {
  if (!esErrorApi(e)) return { campos: {}, general: porDefecto }
  const campos: ErroresAlta = {}
  const sinCampo: string[] = []
  if (e.status === 409) {
    const detalle = e.message.toLowerCase()
    const campo: 'email' | 'dni' | null =
      detalle.includes('email') || detalle.includes('correo') ? 'email' : detalle.includes('dni') ? 'dni' : null
    // El texto del campo es propio del front: el mensaje del backend no se muestra tal cual.
    if (campo && modo === 'nuevo') campos[campo] = MENSAJE_REPETIDO[campo]
    else sinCampo.push(e.message)
  } else {
    const repartidos = erroresDe422(e, CAMPOS_DEL_CONTRATO)
    if (repartidos) {
      Object.assign(campos, repartidos.porCampo)
      sinCampo.push(...repartidos.sinCampo)
    } else {
      sinCampo.push(e.message)
    }
  }
  return { campos, general: sinCampo.length ? sinCampo.join(' ') : 'Revisá los datos marcados.' }
}

// El paso al que hay que volver para ver esos errores: el primero si alguno es de sus campos; si no, ninguno.
export function pasoConErrores(campos: ErroresAlta): PasoAlta | null {
  const afectados = (Object.keys(campos) as CampoAlta[]).map(pasoDelCampo)
  return afectados.includes('datos') ? 'datos' : afectados.includes('plan') ? 'plan' : null
}
