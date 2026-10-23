import type { components } from '@/types/api'

// Cuerpo de error según RFC 9457 (application/problem+json), tal como lo define el contrato.
export type Problema = components['schemas']['Problem']

export const MENSAJE_ERROR_RED = 'No se pudo conectar con el servidor'

export class ErrorApi extends Error {
  readonly status: number
  readonly problema: Problema | undefined

  constructor(status: number, mensaje: string, problema?: Problema) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.status = status
    this.problema = problema
  }
}

export function esErrorApi(e: unknown): e is ErrorApi {
  return e instanceof ErrorApi
}

export function esErrorApiConEstado(e: unknown, status: number): e is ErrorApi {
  return esErrorApi(e) && e.status === status
}

// Una falla de red no tiene respuesta HTTP: se representa con status 0.
export function crearErrorDeRed(): ErrorApi {
  return new ErrorApi(0, MENSAJE_ERROR_RED)
}

function esProblema(cuerpo: unknown): cuerpo is Problema {
  if (typeof cuerpo !== 'object' || cuerpo === null) return false
  const candidato = cuerpo as Record<string, unknown>
  return (
    typeof candidato.title === 'string' &&
    typeof candidato.status === 'number' &&
    typeof candidato.detail === 'string'
  )
}

// Arma el ErrorApi de una respuesta no exitosa: usa el problem+json si viene y, si no, uno mínimo.
export function crearErrorDeRespuesta(status: number, cuerpo: unknown, textoEstado: string): ErrorApi {
  const problema: Problema = esProblema(cuerpo)
    ? cuerpo
    : {
        type: 'about:blank',
        title: textoEstado || `Error ${status}`,
        status,
        detail: typeof cuerpo === 'string' ? cuerpo : '',
      }
  return new ErrorApi(status, problema.detail || problema.title, problema)
}
