import { erroresDe422 } from '@/compartido/erroresFormulario'
import { esErrorApi } from '@/compartido/http/errores'

const CAMPOS_DEL_CONTRATO = { nombre: 'nombre', direccion: 'direccion', aforoMaximo: 'aforoMaximo' } as const

export type CampoSede = (typeof CAMPOS_DEL_CONTRATO)[keyof typeof CAMPOS_DEL_CONTRATO]

// Reparte el error del servidor al crear una sede: lo que corresponde a un campo va junto a ese campo (un 422 por
// propiedad; un 409 que nombra el "nombre", por ejemplo una sede repetida) y el resto queda como error general del modal.
export function repartirErroresSede(e: unknown): { campos: Partial<Record<CampoSede, string>>; general: string | null } {
  if (!esErrorApi(e)) return { campos: {}, general: 'No se pudo crear la sede.' }

  const repartidos = erroresDe422(e, CAMPOS_DEL_CONTRATO)
  if (repartidos) {
    const general = repartidos.sinCampo.join(' ')
    return { campos: repartidos.porCampo, general: general || (Object.keys(repartidos.porCampo).length ? null : 'Datos de la sede inválidos.') }
  }
  if (e.status === 409 && e.message.toLowerCase().includes('nombre')) return { campos: { nombre: e.message }, general: null }
  if (e.status === 422) return { campos: {}, general: e.message || 'Datos de la sede inválidos.' }
  return { campos: {}, general: e.message || 'No se pudo crear la sede.' }
}
