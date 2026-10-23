import type { components, operations } from '@/types/api'
import { desenvolver, type ClienteApi } from '@/compartido/http/clienteApi'

export type Socio = components['schemas']['SocioOut']
export type ListaSocios = components['schemas']['ListaSocios']
export type Membresia = components['schemas']['MembresiaOut']
export type EstadoMembresia = components['schemas']['EstadoMembresia']
export type Plan = components['schemas']['Plan']

// Filtros del listado, con los nombres exactos de los parámetros del contrato (listarSocios).
type QueryListarSocios = NonNullable<operations['listarSocios']['parameters']['query']>
export type FiltrosSocios = Pick<QueryListarSocios, 'nombre' | 'estadoMembresia' | 'plan' | 'sedeOrigenId'>

export interface ServicioSocios {
  listar(filtros: FiltrosSocios, pagina: number, porPagina: number, senal?: AbortSignal): Promise<ListaSocios>
  obtenerMembresia(socioId: number, senal?: AbortSignal): Promise<Membresia>
}

export function crearServicioSocios(cliente: ClienteApi): ServicioSocios {
  return {
    async listar(filtros, pagina, porPagina, senal) {
      return desenvolver(
        await cliente.GET('/socios', {
          params: { query: { ...filtros, page: pagina, perPage: porPagina } },
          signal: senal,
        }),
      )
    },

    async obtenerMembresia(socioId, senal) {
      return desenvolver(
        await cliente.GET('/socios/{socioId}/membresias', {
          params: { path: { socioId } },
          signal: senal,
        }),
      )
    },
  }
}
