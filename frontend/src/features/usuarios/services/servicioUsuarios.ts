import type { components, operations } from '@/types/api'
import { desenvolver, type ClienteApi } from '@/compartido/http/clienteApi'

export type Usuario = components['schemas']['UsuarioOut']
export type UsuarioNuevo = components['schemas']['UsuarioIn']
export type UsuarioPatch = components['schemas']['UsuarioPatch']
export type ListaUsuarios = components['schemas']['ListaUsuarios']

// Filtros del listado, con los nombres exactos de los parámetros del contrato (listarUsuarios).
type QueryListarUsuarios = NonNullable<operations['listarUsuarios']['parameters']['query']>
export type FiltrosUsuarios = Pick<QueryListarUsuarios, 'rol' | 'nombre' | 'email'>

export interface ServicioUsuarios {
  obtener(usuarioId: number, senal?: AbortSignal): Promise<Usuario>
  listar(filtros: FiltrosUsuarios, pagina: number, porPagina: number, senal?: AbortSignal): Promise<ListaUsuarios>
  // Todas las filas de un rol (el contrato pagina): sirve para saber qué sedes
  // ya tienen recepcionista sin depender de la página visible.
  listarTodosPorRol(rol: Usuario['rol'], senal?: AbortSignal): Promise<Usuario[]>
  crear(usuario: UsuarioNuevo): Promise<Usuario>
  // Solo los campos que se mandan cambian; `telefono: null` lo borra. DNI y correo no se pueden modificar.
  modificar(usuarioId: number, cambios: UsuarioPatch): Promise<Usuario>
}

// perPage máximo del contrato (listarUsuarios).
const POR_PAGINA_MAXIMO = 100
// Tope de seguridad para no quedar en un bucle si el total viniera inconsistente.
const MAXIMO_PAGINAS = 50

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

    async listarTodosPorRol(rol, senal) {
      const usuarios: Usuario[] = []
      for (let pagina = 1; pagina <= MAXIMO_PAGINAS; pagina++) {
        const lista = await this.listar({ rol }, pagina, POR_PAGINA_MAXIMO, senal)
        usuarios.push(...lista.items)
        if (lista.items.length === 0 || usuarios.length >= lista.total) break
      }
      return usuarios
    },

    async crear(usuario) {
      return desenvolver(await cliente.POST('/usuarios', { body: usuario }))
    },

    async modificar(usuarioId, cambios) {
      return desenvolver(
        await cliente.PATCH('/usuarios/{id}', { params: { path: { id: usuarioId } }, body: cambios }),
      )
    },
  }
}
