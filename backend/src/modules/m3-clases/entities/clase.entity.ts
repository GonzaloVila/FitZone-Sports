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

export interface ClaseConCupo extends Clase {
  reservasConfirmadas: number;
  cupoDisponible: number;
}
