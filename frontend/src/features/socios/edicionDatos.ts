import { esErrorApi } from '@/compartido/http/errores'
import type { Usuario, UsuarioPatch } from '@/features/usuarios/services/servicioUsuarios'
import { erroresDe422 } from '@/compartido/erroresFormulario'

// Lo que se edita de un usuario desde la ficha. El DNI y el correo no se pueden cambiar.
export interface DatosEditables {
  nombre: string
  telefono: string
}

export type CampoEditable = keyof DatosEditables

export type ErroresEdicion = Partial<Record<CampoEditable, string>>

const CAMPOS_DEL_CONTRATO: Record<string, CampoEditable> = { nombre: 'nombre', telefono: 'telefono' }

// Los valores de partida del formulario salen del socio (el nombre) y del usuario (el teléfono, que puede faltar).
export function datosIniciales(nombre: string, usuario: Pick<Usuario, 'telefono'> | null): DatosEditables {
  return { nombre, telefono: usuario?.telefono ?? '' }
}

// Solo viajan los campos que cambiaron (con los espacios de los bordes recortados). Un teléfono vaciado se manda
// como null, que es como el contrato lo borra.
export function cambiosDeDatos(original: DatosEditables, editado: DatosEditables): UsuarioPatch {
  const cambios: UsuarioPatch = {}
  const nombre = editado.nombre.trim()
  const telefono = editado.telefono.trim()
  if (nombre !== original.nombre.trim()) cambios.nombre = nombre
  if (telefono !== original.telefono.trim()) cambios.telefono = telefono === '' ? null : telefono
  return cambios
}

export const hayCambios = (cambios: UsuarioPatch): boolean => Object.keys(cambios).length > 0

// Validación de ayuda: la validación real la hace el backend.
export function erroresDeDatos(editado: DatosEditables): ErroresEdicion {
  return editado.nombre.trim() ? {} : { nombre: 'Ingresá el nombre y apellido.' }
}

// Errores del servidor: un 422 se reparte por campo; cualquier otro va como error general del modal.
export function repartirErroresEdicion(e: unknown, porDefecto: string): { campos: ErroresEdicion; general: string | null } {
  const repartidos = erroresDe422(e, CAMPOS_DEL_CONTRATO)
  if (repartidos) {
    const general = repartidos.sinCampo.length ? repartidos.sinCampo.join(' ') : null
    return { campos: repartidos.porCampo, general: general ?? (Object.keys(repartidos.porCampo).length ? null : porDefecto) }
  }
  return { campos: {}, general: esErrorApi(e) ? e.message : porDefecto }
}
