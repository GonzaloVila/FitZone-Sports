export interface Cancha {
  id: number;
  sedeId: number;
  tipo: 'PADDLE' | 'FUTBOL5';
  costoPorHora: number;
  estado: 'OPERATIVA' | 'EN_MANTENIMIENTO';
}
