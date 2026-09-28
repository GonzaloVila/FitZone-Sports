export type EstadoReservaClase = 'CONFIRMADA' | 'CANCELADA';

export interface ReservaClase {
  id: number;
  clase_id: number;
  socio_id: number;
  estado: EstadoReservaClase;
}

export type ReservaClaseNueva = Omit<ReservaClase, 'id'>;
