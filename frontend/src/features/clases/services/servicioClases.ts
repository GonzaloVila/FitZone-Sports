import type { components, operations } from '@/types/api'
import { desenvolver, type ClienteApi } from '@/compartido/http/clienteApi'

export type Clase = components['schemas']['ClaseOut']
export type ClaseNueva = components['schemas']['ClaseIn']
export type ListaClases = components['schemas']['ListaClases']
export type ReservaClase = components['schemas']['ReservaClaseOut']
export type ListaReservasClase = components['schemas']['ListaReservasClase']
export type EstadoReservaClase = components['schemas']['EstadoReservaClase']
export type EsperaClase = components['schemas']['EsperaOut']
export type ListaEsperas = components['schemas']['ListaEsperas']
export type EstadoEspera = components['schemas']['EstadoEspera']

// Filtros con los nombres exactos de los parámetros del contrato.
type QueryListarClases = NonNullable<operations['listarClases']['parameters']['query']>
export type FiltrosClases = Pick<QueryListarClases, 'tipo' | 'sedeId'>

type QueryListarReservas = NonNullable<operations['listarReservasClase']['parameters']['query']>
export type FiltrosReservasClase = Pick<QueryListarReservas, 'claseId' | 'socioId' | 'estado'>

type QueryListarEsperas = NonNullable<operations['listarEsperasClase']['parameters']['query']>
export type FiltrosEsperasClase = Pick<QueryListarEsperas, 'claseId' | 'socioId' | 'estado'>

export interface ServicioClases {
  listar(filtros: FiltrosClases, pagina: number, porPagina: number, senal?: AbortSignal): Promise<ListaClases>
  obtener(claseId: number, senal?: AbortSignal): Promise<Clase>
  crear(clase: ClaseNueva): Promise<Clase>
  // Ocupación de la clase: sin `estado` trae solo las confirmadas.
  listarInscriptos(claseId: number, pagina: number, porPagina: number, senal?: AbortSignal): Promise<ListaReservasClase>

  listarReservas(
    filtros: FiltrosReservasClase,
    pagina: number,
    porPagina: number,
    senal?: AbortSignal,
  ): Promise<ListaReservasClase>
  reservar(claseId: number, socioId: number): Promise<ReservaClase>
  // 204 sin cuerpo. Dentro de las 2 hs previas el servidor cobra la penalidad.
  cancelarReserva(reservaId: number): Promise<void>

  // Sin `estado` trae EN_ESPERA y NOTIFICADO.
  listarEsperaDeClase(claseId: number, pagina: number, porPagina: number, senal?: AbortSignal): Promise<ListaEsperas>
  listarEsperas(
    filtros: FiltrosEsperasClase,
    pagina: number,
    porPagina: number,
    senal?: AbortSignal,
  ): Promise<ListaEsperas>
  anotarseEnEspera(claseId: number, socioId: number): Promise<EsperaClase>
  salirDeEspera(esperaId: number): Promise<void>
  // Convierte la espera notificada en reserva.
  confirmarEspera(esperaId: number): Promise<ReservaClase>
}

export function crearServicioClases(cliente: ClienteApi): ServicioClases {
  return {
    async listar(filtros, pagina, porPagina, senal) {
      return desenvolver(
        await cliente.GET('/clases', {
          params: { query: { ...filtros, page: pagina, perPage: porPagina } },
          signal: senal,
        }),
      )
    },

    async obtener(claseId, senal) {
      return desenvolver(await cliente.GET('/clases/{claseId}', { params: { path: { claseId } }, signal: senal }))
    },

    async crear(clase) {
      return desenvolver(await cliente.POST('/clases', { body: clase }))
    },

    async listarInscriptos(claseId, pagina, porPagina, senal) {
      return desenvolver(
        await cliente.GET('/clases/{claseId}/reservas', {
          params: { path: { claseId }, query: { page: pagina, perPage: porPagina } },
          signal: senal,
        }),
      )
    },

    async listarReservas(filtros, pagina, porPagina, senal) {
      return desenvolver(
        await cliente.GET('/reservas-clases', {
          params: { query: { ...filtros, page: pagina, perPage: porPagina } },
          signal: senal,
        }),
      )
    },

    async reservar(claseId, socioId) {
      return desenvolver(await cliente.POST('/reservas-clases', { body: { claseId, socioId } }))
    },

    async cancelarReserva(reservaId) {
      desenvolver(
        await cliente.POST('/reservas-clases/{reservaClaseId}/cancelaciones', {
          params: { path: { reservaClaseId: reservaId } },
        }),
      )
    },

    async listarEsperaDeClase(claseId, pagina, porPagina, senal) {
      return desenvolver(
        await cliente.GET('/clases/{claseId}/espera', {
          params: { path: { claseId }, query: { page: pagina, perPage: porPagina } },
          signal: senal,
        }),
      )
    },

    async listarEsperas(filtros, pagina, porPagina, senal) {
      return desenvolver(
        await cliente.GET('/esperas-clases', {
          params: { query: { ...filtros, page: pagina, perPage: porPagina } },
          signal: senal,
        }),
      )
    },

    async anotarseEnEspera(claseId, socioId) {
      return desenvolver(
        await cliente.POST('/clases/{claseId}/espera', { params: { path: { claseId } }, body: { socioId } }),
      )
    },

    async salirDeEspera(esperaId) {
      desenvolver(await cliente.DELETE('/esperas-clases/{esperaId}', { params: { path: { esperaId } } }))
    },

    async confirmarEspera(esperaId) {
      return desenvolver(
        await cliente.POST('/esperas-clases/{esperaId}/confirmaciones', { params: { path: { esperaId } } }),
      )
    },
  }
}
