import type { components, operations } from '@/types/api'
import { desenvolver, type ClienteApi } from '@/compartido/http/clienteApi'
import { crearErrorDeRespuesta } from '@/compartido/http/errores'

export type Pago = components['schemas']['PagoOut']
export type ListaPagos = components['schemas']['ListaPagos']
export type PagoIn = components['schemas']['PagoIn']
export type ConceptoPago = components['schemas']['ConceptoPago']
export type EstadoPago = components['schemas']['EstadoPago']

type QueryListarPagos = NonNullable<operations['listarPagos']['parameters']['query']>
export type FiltrosPagos = Pick<
  QueryListarPagos,
  'usuarioId' | 'estado' | 'tipo' | 'reservaCanchaId' | 'membresiaId' | 'reservaClaseId' | 'desde' | 'hasta'
>

export interface ServicioPagos {
  procesar(pago: PagoIn, idempotencyKey: string): Promise<Pago>
  listar(filtros: FiltrosPagos, pagina: number, porPagina: number, senal?: AbortSignal): Promise<ListaPagos>
  obtener(pagoId: number, senal?: AbortSignal): Promise<Pago>
  anular(pagoId: number): Promise<void>
  descargarComprobante(pagoId: number, senal?: AbortSignal): Promise<Blob>
  descargarReporte(desde?: string, hasta?: string, senal?: AbortSignal): Promise<Blob>
}

// Con parseAs: 'blob' el error también llega como Blob: se lee el problem+json antes de armar el ErrorApi.
async function desenvolverPdf(resultado: { data?: Blob; error?: unknown; response: Response }): Promise<Blob> {
  if (resultado.response.ok && resultado.data instanceof Blob) return resultado.data
  let cuerpo: unknown = resultado.error
  if (resultado.error instanceof Blob) {
    try {
      cuerpo = JSON.parse(await resultado.error.text())
    } catch {
      cuerpo = undefined
    }
  }
  throw crearErrorDeRespuesta(resultado.response.status, cuerpo, resultado.response.statusText)
}

export function crearServicioPagos(cliente: ClienteApi): ServicioPagos {
  return {
    async procesar(pago, idempotencyKey) {
      return desenvolver(
        await cliente.POST('/pagos', {
          params: { header: { 'Idempotency-Key': idempotencyKey } },
          body: pago,
        }),
      )
    },

    async listar(filtros, pagina, porPagina, senal) {
      return desenvolver(
        await cliente.GET('/pagos', {
          params: { query: { ...filtros, page: pagina, perPage: porPagina } },
          signal: senal,
        }),
      )
    },

    async obtener(pagoId, senal) {
      return desenvolver(
        await cliente.GET('/pagos/{pagoId}', { params: { path: { pagoId } }, signal: senal }),
      )
    },

    async anular(pagoId) {
      desenvolver(await cliente.POST('/pagos/{pagoId}/anulaciones', { params: { path: { pagoId } } }))
    },

    async descargarComprobante(pagoId, senal) {
      return desenvolverPdf(
        await cliente.GET('/pagos/{pagoId}/comprobante', {
          params: { path: { pagoId } },
          parseAs: 'blob',
          signal: senal,
        }),
      )
    },

    async descargarReporte(desde, hasta, senal) {
      return desenvolverPdf(
        await cliente.GET('/reportes/pagos', {
          params: { query: { desde, hasta } },
          parseAs: 'blob',
          signal: senal,
        }),
      )
    },
  }
}
