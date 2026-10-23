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

// Dato que se pide aparte y puede fallar sin romper el resto de la pantalla.
export type Opcional<T> =
  | { situacion: 'cargando' }
  | { situacion: 'disponible'; valor: T }
  | { situacion: 'no-disponible' }

export type AccionSocio =
  | 'suspender'
  | 'reactivar'
  | 'cambiar-plan'
  | 'renovacion-automatica'
  | 'cambiar-sede'
  | 'dejar-de-ser-socio'
