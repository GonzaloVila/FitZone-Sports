import type { components, operations } from '@/types/api'
import { desenvolver, type ClienteApi } from '@/compartido/http/clienteApi'

export type Aforo = components['schemas']['AforoOut']
export type Ingreso = components['schemas']['IngresoOut']
export type IngresoIn = components['schemas']['IngresoIn']
export type ListaIngresos = components['schemas']['ListaIngresos']
export type SincronizarIngresosIn = components['schemas']['SincronizarIngresosIn']
export type SincronizarIngresosOut = components['schemas']['SincronizarIngresosOut']

export type FiltrosIngresos = NonNullable<operations['listarIngresos']['parameters']['query']>

export interface ServicioAcceso {
  obtenerAforo(sedeId: number, senal?: AbortSignal): Promise<Aforo>
  registrarIngreso(ingreso: IngresoIn): Promise<Ingreso>
  registrarEgreso(ingresoId: number): Promise<void>
  listarIngresos(filtros?: FiltrosIngresos, senal?: AbortSignal): Promise<ListaIngresos>
  obtenerIngreso(ingresoId: number, senal?: AbortSignal): Promise<Ingreso>
  sincronizarIngresos(datos: SincronizarIngresosIn): Promise<SincronizarIngresosOut>
}

export function crearServicioAcceso(cliente: ClienteApi): ServicioAcceso {
  return {
    async obtenerAforo(sedeId, senal) {
      return desenvolver(
        await cliente.GET('/sedes/{sedeId}/aforo', {
          params: { path: { sedeId } },
          signal: senal,
        }),
      )
    },

    async registrarIngreso(ingreso) {
      return desenvolver(
        await cliente.POST('/ingresos', {
          body: ingreso,
        }),
      )
    },

    async registrarEgreso(ingresoId) {
      desenvolver(
        await cliente.POST('/ingresos/{ingresoId}/egreso', {
          params: { path: { ingresoId } },
        }),
      )
    },

    async listarIngresos(filtros, senal) {
      return desenvolver(
        await cliente.GET('/ingresos', {
          params: { query: filtros },
          signal: senal,
        }),
      )
    },

    async obtenerIngreso(ingresoId, senal) {
      return desenvolver(
        await cliente.GET('/ingresos/{ingresoId}', {
          params: { path: { ingresoId } },
          signal: senal,
        }),
      )
    },

    async sincronizarIngresos(datos) {
      return desenvolver(
        await cliente.POST('/sincronizacion/ingresos', {
          body: datos,
        }),
      )
    },
  }
}
