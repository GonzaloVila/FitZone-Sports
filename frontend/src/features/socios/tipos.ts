import type { Membresia, Socio } from './services/servicioSocios'

// El listado de socios del contrato no trae plan ni estado: se piden aparte, por fila.
export type MembresiaFila =
  | { situacion: 'cargando' }
  | { situacion: 'disponible'; membresia: Membresia }
  | { situacion: 'no-disponible' }

export interface FilaSocio {
  socio: Socio
  membresia: MembresiaFila
}

// '' significa "todos". Los valores se validan contra el contrato antes de enviarse (ver useListaSocios).
export interface FiltrosListaSocios {
  nombre: string
  estado: string
  plan: string
  sede: string
}
