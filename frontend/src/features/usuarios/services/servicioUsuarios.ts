import type { components, operations } from '@/types/api'
import { desenvolver, type ClienteApi } from '@/compartido/http/clienteApi'

export type Usuario = components['schemas']['UsuarioOut']
export type UsuarioNuevo = components['schemas']['UsuarioIn']
export type ListaUsuarios = components['schemas']['ListaUsuarios']

// Filtros del listado, con los nombres exactos de los parámetros del contrato (listarUsuarios).
type QueryListarUsuarios = NonNullable<operations['listarUsuarios']['parameters']['query']>
export type FiltrosUsuarios = Pick<QueryListarUsuarios, 'rol' | 'nombre' | 'email'>

export interface ServicioUsuarios {
  obtener(usuarioId: number, senal?: AbortSignal): Promise<Usuario>
  listar(filtros: FiltrosUsuarios, pagina: number, porPagina: number, senal?: AbortSignal): Promise<ListaUsuarios>
  crear(usuario: UsuarioNuevo): Promise<Usuario>
}

export function crearServicioUsuarios(cliente: ClienteApi): ServicioUsuarios {
  return {
    async obtener(usuarioId, senal) {
      return desenvolver(
        await cliente.GET('/usuarios/{id}', { params: { path: { id: usuarioId } }, signal: senal }),
      )
    },

    async listar(filtros, pagina, porPagina, senal) {
      return desenvolver(
        await cliente.GET('/usuarios', {
          params: { query: { ...filtros, page: pagina, perPage: porPagina } },
          signal: senal,
        }),
      )
    },

    async crear(usuario) {
      return desenvolver(await cliente.POST('/usuarios', { body: usuario }))
    },
  }
}
