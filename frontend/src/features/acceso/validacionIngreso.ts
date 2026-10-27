import { comoTexto } from '@/compartido/comoTexto'

export interface DatosIngreso {
  // null/undefined = sin sede elegida.
  sedeId: number | null | undefined
  // Los campos numéricos entregan un número en runtime aunque el modelo se declare como texto: se aceptan los dos.
  socioId: unknown
  codigoTotp: unknown
}

export type ErroresIngreso = Partial<Record<'sedeId' | 'socioId' | 'codigoTotp', string>>

// Validación de ayuda de uso del registro de ingreso (el servidor siempre decide). La sede es un select obligatorio: se pide
// con "Elegí …", igual que en los demás formularios de alta.
export function validarIngreso(datos: DatosIngreso): ErroresIngreso {
  const errores: ErroresIngreso = {}
  if (!datos.sedeId) errores.sedeId = 'Elegí la sede de acceso.'
  const socio = Number(comoTexto(datos.socioId))
  if (comoTexto(datos.socioId) === '' || !Number.isInteger(socio) || socio <= 0) errores.socioId = 'Ingresá el número de socio.'
  if (comoTexto(datos.codigoTotp) === '') errores.codigoTotp = 'Ingresá el código del carnet.'
  return errores
}
