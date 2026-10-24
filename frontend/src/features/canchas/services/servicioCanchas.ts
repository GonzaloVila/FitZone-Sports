import type { components, operations } from '@/types/api'
import { desenvolver, type ClienteApi } from '@/compartido/http/clienteApi'

export type Cancha = components['schemas']['CanchaOut']
export type CanchaNueva = components['schemas']['CanchaIn']
export type CanchaPatch = components['schemas']['CanchaPatch']
export type ListaCanchas = components['schemas']['ListaCanchas']
export type Disponibilidad = components['schemas']['DisponibilidadEntrada']
export type ListaDisponibilidad = components['schemas']['ListaDisponibilidad']
export type ReservaCancha = components['schemas']['ReservaCanchaOut']
export type ReservaCanchaNueva = components['schemas']['ReservaCanchaIn']
export type ListaReservasCancha = components['schemas']['ListaReservasCancha']
export type EstadoCancha = components['schemas']['EstadoCancha']
export type EstadoReserva = components['schemas']['EstadoReserva']
export type TipoCancha = components['schemas']['TipoCancha']

type QueryListarCanchas = NonNullable<operations['listarCanchas']['parameters']['query']>
export type FiltrosCanchas = Pick<QueryListarCanchas, 'estado'>

type QueryListarReservasCancha = NonNullable<operations['listarReservasCancha']['parameters']['query']>
export type FiltrosReservasCancha = Pick<
  QueryListarReservasCancha,
  'canchaId' | 'usuarioId' | 'estado' | 'fecha'
>

export interface ServicioCanchas {
  listar(
    sedeId: number,
    filtros: FiltrosCanchas,
    pagina: number,
    porPagina: number,
    senal?: AbortSignal,
  ): Promise<ListaCanchas>
  obtener(canchaId: number, senal?: AbortSignal): Promise<Cancha>
  crear(sedeId: number, cancha: CanchaNueva): Promise<Cancha>
  modificar(canchaId: number, cambios: CanchaPatch): Promise<Cancha>
  consultarDisponibilidad(canchaId: number, fecha: string, senal?: AbortSignal): Promise<ListaDisponibilidad>
  crearReserva(reserva: ReservaCanchaNueva): Promise<ReservaCancha>
  listarReservas(
    filtros: FiltrosReservasCancha,
    pagina: number,
    porPagina: number,
    senal?: AbortSignal,
  ): Promise<ListaReservasCancha>
  obtenerReserva(reservaCanchaId: number, senal?: AbortSignal): Promise<ReservaCancha>
  cancelarReserva(reservaCanchaId: number): Promise<void>
}

export function crearServicioCanchas(cliente: ClienteApi): ServicioCanchas {
  return {
    async listar(sedeId, filtros, pagina, porPagina, senal) {
      return desenvolver(
        await cliente.GET('/sedes/{sedeId}/canchas', {
          params: { path: { sedeId }, query: { ...filtros, page: pagina, perPage: porPagina } },
          signal: senal,
        }),
      )
    },

    async obtener(canchaId, senal) {
      return desenvolver(
        await cliente.GET('/canchas/{canchaId}', { params: { path: { canchaId } }, signal: senal }),
      )
    },

    async crear(sedeId, cancha) {
      return desenvolver(
        await cliente.POST('/sedes/{sedeId}/canchas', { params: { path: { sedeId } }, body: cancha }),
      )
    },

    async modificar(canchaId, cambios) {
      return desenvolver(
        await cliente.PATCH('/canchas/{canchaId}', { params: { path: { canchaId } }, body: cambios }),
      )
    },

    async consultarDisponibilidad(canchaId, fecha, senal) {
      return desenvolver(
        await cliente.GET('/canchas/{canchaId}/disponibilidad', {
          params: { path: { canchaId }, query: { fecha, perPage: 100 } },
          signal: senal,
        }),
      )
    },

    async crearReserva(reserva) {
      return desenvolver(await cliente.POST('/reservas-canchas', { body: reserva }))
    },

    async listarReservas(filtros, pagina, porPagina, senal) {
      return desenvolver(
        await cliente.GET('/reservas-canchas', {
          params: { query: { ...filtros, page: pagina, perPage: porPagina } },
          signal: senal,
        }),
      )
    },

    async obtenerReserva(reservaCanchaId, senal) {
      return desenvolver(
        await cliente.GET('/reservas-canchas/{reservaCanchaId}', {
          params: { path: { reservaCanchaId } },
          signal: senal,
        }),
      )
    },

    async cancelarReserva(reservaCanchaId) {
      desenvolver(
        await cliente.POST('/reservas-canchas/{reservaCanchaId}/cancelaciones', {
          params: { path: { reservaCanchaId } },
        }),
      )
    },
  }
}
