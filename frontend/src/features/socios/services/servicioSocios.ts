import type { components, operations } from '@/types/api'
import { desenvolver, type ClienteApi } from '@/compartido/http/clienteApi'

export type Socio = components['schemas']['SocioOut']
export type ListaSocios = components['schemas']['ListaSocios']
export type Membresia = components['schemas']['MembresiaOut']
export type EstadoMembresia = components['schemas']['EstadoMembresia']
export type Plan = components['schemas']['Plan']
export type SocioPatch = components['schemas']['SocioPatch']
export type MembresiaPatch = components['schemas']['MembresiaPatch']
export type SocioNuevo = components['schemas']['SocioIn']
export type RegistroQr = components['schemas']['RegistroQrOut']

// Filtros del listado, con los nombres exactos de los parámetros del contrato (listarSocios).
type QueryListarSocios = NonNullable<operations['listarSocios']['parameters']['query']>
export type FiltrosSocios = Pick<QueryListarSocios, 'nombre' | 'estadoMembresia' | 'plan' | 'sedeOrigenId'>

export interface ServicioSocios {
  listar(filtros: FiltrosSocios, pagina: number, porPagina: number, senal?: AbortSignal): Promise<ListaSocios>
  obtenerMembresia(socioId: number, senal?: AbortSignal): Promise<Membresia>
  obtener(socioId: number, senal?: AbortSignal): Promise<Socio>
  crear(socio: SocioNuevo): Promise<Socio>
  modificar(socioId: number, cambios: SocioPatch): Promise<Socio>
  dejarDeSerSocio(socioId: number): Promise<void>
  modificarMembresia(socioId: number, cambios: MembresiaPatch): Promise<Membresia>
  // Crea (o SOBRESCRIBE) el secreto TOTP del socio autenticado. Nunca llamarla al cargar una pantalla.
  registrarQr(): Promise<RegistroQr>
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

    async obtener(socioId, senal) {
      return desenvolver(
        await cliente.GET('/socios/{socioId}', { params: { path: { socioId } }, signal: senal }),
      )
    },

    async crear(socio) {
      return desenvolver(await cliente.POST('/socios', { body: socio }))
    },

    async modificar(socioId, cambios) {
      return desenvolver(
        await cliente.PATCH('/socios/{socioId}', { params: { path: { socioId } }, body: cambios }),
      )
    },

    async dejarDeSerSocio(socioId) {
      desenvolver(await cliente.DELETE('/socios/{socioId}', { params: { path: { socioId } } }))
    },

    async modificarMembresia(socioId, cambios) {
      return desenvolver(
        await cliente.PATCH('/socios/{socioId}/membresias', { params: { path: { socioId } }, body: cambios }),
      )
    },

    async registrarQr() {
      return desenvolver(await cliente.POST('/auth/registro-qr'))
    },
  }
}
