export interface Clase {
  id: number;
  sedeId: number;
  tipo: string;
  instructor: string;
  horarioInicio: Date;
  horarioFin: Date;
  capacidad: number;
}

export type ClaseNueva = Omit<Clase, 'id'>;

// Estado de una clase en el listado. No se persiste: se DERIVA del horario y de los cupos (una clase que ya empezó es
// COMENZADA aunque tenga cupos; una futura sin cupo disponible es SIN_CUPOS; el resto, CON_CUPOS).
export const ESTADOS_CLASE = ['CON_CUPOS', 'SIN_CUPOS', 'COMENZADA'] as const;
export type EstadoClase = (typeof ESTADOS_CLASE)[number];

export interface ClaseConCupo extends Clase {
  reservasConfirmadas: number;
  cupoDisponible: number;
}
