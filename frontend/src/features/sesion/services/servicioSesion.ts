import type { components } from '@/types/api'
import type { AlmacenToken } from '@/compartido/http/almacenToken'
import { desenvolver, type ClienteApi } from '@/compartido/http/clienteApi'

export type Credenciales = components['schemas']['LoginIn']
export type SesionIniciada = components['schemas']['LoginOut']

export interface ServicioSesion {
  iniciarSesion(credenciales: Credenciales): Promise<SesionIniciada>
  renovar(): Promise<SesionIniciada>
  cerrarSesion(): Promise<void>
}

export function crearServicioSesion(cliente: ClienteApi, almacenToken: AlmacenToken): ServicioSesion {
  return {
    async iniciarSesion(credenciales) {
      const sesion = desenvolver(await cliente.POST('/auth/login', { body: credenciales }))
      almacenToken.guardar(sesion.accessToken)
      return sesion
    },

    async renovar() {
      const sesion = desenvolver(await cliente.POST('/auth/refresh'))
      almacenToken.guardar(sesion.accessToken)
      return sesion
    },

    async cerrarSesion() {
      try {
        desenvolver(await cliente.POST('/auth/logout'))
      } finally {
        // El acceso local se descarta aunque falle el aviso al servidor.
        almacenToken.guardar(null)
      }
    },
  }
}
