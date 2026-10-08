export interface Clase {
  id: number;
  sedeId: number;
  tipo: string;
  instructor: string;
  horario: string;
  capacidad: number;
}

export type ClaseNueva = Omit<Clase, 'id'>;

export interface ClaseConCupo extends Clase {
  reservasConfirmadas: number;
  cupoDisponible: number;
}
