import { esErrorApiConEstado } from '@/compartido/http/errores'

// Un 422 del contrato trae `errors`: cada mensaje empieza por el nombre de la propiedad ("nombre must be ...").
// Reparte esos mensajes por campo del formulario según `campos` (propiedad del contrato -> campo); los que no
// corresponden a ningún campo quedan en `sinCampo`. Devuelve null si el error no es un 422 con detalle.
export function erroresDe422<Campo extends string>(
  e: unknown,
  campos: Record<string, Campo>,
): { porCampo: Partial<Record<Campo, string>>; sinCampo: string[] } | null {
  if (!esErrorApiConEstado(e, 422) || !e.problema?.errors?.length) return null
  const porCampo: Partial<Record<Campo, string>> = {}
  const sinCampo: string[] = []
  for (const mensaje of e.problema.errors) {
    const campo = campos[mensaje.split(' ')[0] ?? '']
    if (campo) porCampo[campo] = mensaje
    else sinCampo.push(mensaje)
  }
  return { porCampo, sinCampo }
}
