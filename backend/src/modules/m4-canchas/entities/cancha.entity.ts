export interface Cancha {
  id: number;
  sede_id: number;
  tipo: 'PADDLE' | 'FUTBOL5';
  costo_por_hora: number;
  estado: 'OPERATIVA' | 'EN_MANTENIMIENTO';
}
