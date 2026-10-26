import { erroresDe422 } from '@/compartido/erroresFormulario'
import { esErrorApi } from '@/compartido/http/errores'

export interface DatosStaff {
  nombre: string
  dni: string
  email: string
  telefono: string
  contrasenia: string
  // Se guarda como string porque es el valor del <select>; el composable lo
  // convierte a número recién al enviar.
  sedeId: string
}

export type CampoStaff = keyof DatosStaff

export type ErroresStaff = Partial<Record<CampoStaff, string>>

export const datosStaffVacios = (): DatosStaff => ({
  nombre: '',
  dni: '',
  email: '',
  telefono: '',
  contrasenia: '',
  sedeId: '',
})

// La validación real la hace el backend; esto solo evita un viaje por errores
// evidentes y usa los mismos límites del contrato (UsuarioIn).
const FORMATO_DNI = /^\d{7,20}$/
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const LARGO_MINIMO_CONTRASENIA = 8
export const LARGO_MAXIMO_TELEFONO = 20

export const erroresDeDatos = (datos: DatosStaff): ErroresStaff => {
  const errores: ErroresStaff = {}
  if (!datos.nombre.trim()) errores.nombre = 'Ingresá el nombre y apellido.'
  else if (datos.nombre.trim().length > 100) errores.nombre = 'El nombre no puede superar los 100 caracteres.'

  if (!FORMATO_DNI.test(datos.dni.trim())) {
    errores.dni = 'El DNI tiene entre 7 y 20 dígitos, sin puntos ni espacios.'
  }

  if (!FORMATO_EMAIL.test(datos.email.trim())) errores.email = 'Ingresá un correo válido.'

  const telefono = datos.telefono.trim()
  if (telefono.length > LARGO_MAXIMO_TELEFONO) {
    errores.telefono = `El teléfono no puede superar los ${LARGO_MAXIMO_TELEFONO} caracteres.`
  }

  if (datos.contrasenia.length === 0) errores.contrasenia = 'Ingresá una contraseña.'
  else if (datos.contrasenia.length < LARGO_MINIMO_CONTRASENIA) {
    errores.contrasenia = `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENIA} caracteres.`
  }

  if (!datos.sedeId) errores.sedeId = 'Elegí la sede de trabajo.'
  return errores
}

export const hayErrores = (errores: ErroresStaff): boolean => Object.keys(errores).length > 0

// Nombre de la propiedad del contrato -> campo del formulario.
const CAMPOS_DEL_CONTRATO: Record<string, CampoStaff> = {
  nombre: 'nombre',
  dni: 'dni',
  email: 'email',
  telefono: 'telefono',
  contrasenia: 'contrasenia',
  sedeId: 'sedeId',
}

const MENSAJE_REPETIDO = {
  email: 'Ya existe un usuario con ese correo.',
  dni: 'Ya existe un usuario con ese DNI.',
} as const

// Reparte el error del alta: los 422 de validación vienen por propiedad; los
// 422 de negocio (por ejemplo, RECEPCION sin sede) y los 409 traen solo un
// `detail`, así que se reconoce el campo por la palabra que nombran.
export function repartirErroresStaff(e: unknown, porDefecto: string): { campos: ErroresStaff; general: string | null } {
  if (!esErrorApi(e)) return { campos: {}, general: porDefecto }

  const repartidos = erroresDe422(e, CAMPOS_DEL_CONTRATO)
  if (repartidos) {
    const general = repartidos.sinCampo.join(' ')
    const hayCampos = Object.keys(repartidos.porCampo).length > 0
    return {
      campos: repartidos.porCampo,
      general: general || (hayCampos ? null : e.message || porDefecto),
    }
  }

  const detalle = e.message.toLowerCase()
  const campos: ErroresStaff = {}
  if (e.status === 409) {
    if (detalle.includes('sede')) campos.sedeId = e.message
    else if (detalle.includes('email') || detalle.includes('correo')) campos.email = MENSAJE_REPETIDO.email
    else if (detalle.includes('dni')) campos.dni = MENSAJE_REPETIDO.dni
    if (Object.keys(campos).length) return { campos, general: null }
    return { campos: {}, general: e.message || porDefecto }
  }

  if (e.status === 422) {
    if (detalle.includes('sede')) campos.sedeId = e.message
    if (Object.keys(campos).length) return { campos, general: null }
    return { campos: {}, general: e.message || 'Datos del recepcionista inválidos.' }
  }

  return { campos: {}, general: e.message || porDefecto }
}
