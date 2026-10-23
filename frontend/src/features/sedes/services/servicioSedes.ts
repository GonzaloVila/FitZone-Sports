import type { components } from '@/types/api'
import { desenvolver, type ClienteApi } from '@/compartido/http/clienteApi'

export type Sede = components['schemas']['SedeOut']
export type SedeIn = components['schemas']['SedeIn']

// perPage máximo que permite el contrato (listarSedes).
const POR_PAGINA_MAXIMO = 100
// Tope de seguridad para no quedar en un bucle si el servidor devolviera un total inconsistente.
const MAXIMO_PAGINAS = 50

export interface ServicioSedes {
  // Todas las sedes (el contrato pagina el listado, así que se piden páginas hasta traerlas todas).
  listar(senal?: AbortSignal): Promise<Sede[]>
  // Alta de sede (RNF-04)
  crear(sede: SedeIn): Promise<Sede>
}

export function crearServicioSedes(cliente: ClienteApi): ServicioSedes {
  return {
    async listar(senal) {
      const sedes: Sede[] = []
      for (let pagina = 1; pagina <= MAXIMO_PAGINAS; pagina++) {
        const lista = desenvolver(
          await cliente.GET('/sedes', {
            params: { query: { page: pagina, perPage: POR_PAGINA_MAXIMO } },
            signal: senal,
          }),
        )
        sedes.push(...lista.items)
        if (lista.items.length === 0 || sedes.length >= lista.total) break
      }
      return sedes
    },

    async crear(sede) {
      return desenvolver(
        await cliente.POST('/sedes', {
          body: sede,
        }),
      )
    },
  }
}
