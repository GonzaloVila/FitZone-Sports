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

// Lo que se puede pedir desde el menú de una fila: ver la ficha o abrir el modal de una acción.
export type AccionFila = 'ver-ficha' | Extract<AccionSocio, 'cambiar-plan' | 'suspender' | 'reactivar' | 'dejar-de-ser-socio'>

// Las acciones de una fila que se resuelven en un modal.
export type AccionConModal = Exclude<AccionFila, 'ver-ficha'>

// Lo que se puede pedir desde el menú de la ficha: las acciones con modal compartido o el cambio de sede.
export type AccionFicha = AccionConModal | 'cambiar-sede'

// Dónde se muestra el menú de acciones de un socio: la fila de la lista o la ficha.
export type ContextoMenuSocio = 'lista' | 'ficha'

// Lo mínimo del socio que muestran los modales (la lista y la ficha lo arman con lo que tienen).
export type SocioResumen = Pick<Socio, 'id' | 'nombre' | 'email'>
