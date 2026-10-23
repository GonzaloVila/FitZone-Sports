import type { Clase, EsperaClase, ReservaClase } from './services/servicioClases'

export interface FiltrosAgendaClases {
  tipo: string
  // Id de sede como texto (valor del select); vacío = todas.
  sede: string
}

// Reserva del socio con los datos de su clase (null si la clase no se pudo cargar).
export interface FilaReserva {
  reserva: ReservaClase
  clase: Clase | null
}

// Espera del socio con su clase y su lugar en la cola (null si no se pudo calcular).
export interface FilaEspera {
  espera: EsperaClase
  clase: Clase | null
  posicion: number | null
}

export interface FormularioClaseDatos {
  sedeId: string
  tipo: string
  instructor: string
  // Fecha (YYYY-MM-DD) y horas (HH:mm) tal como las entregan los inputs.
  dia: string
  horaInicio: string
  horaFin: string
  capacidad: string
}
