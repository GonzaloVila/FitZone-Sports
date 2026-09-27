export interface Clase {
  id: number;
  sede_id: number;
  tipo: string;
  instructor: string;
  horario: string;
  capacidad: number;
}

export type ClaseNueva = Omit<Clase, 'id'>;

export interface ClaseConCupo extends Clase {
  reservas_confirmadas: number;
  cupo_disponible: number;
}
