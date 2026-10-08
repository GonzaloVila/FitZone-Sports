export type EstadoReservaClase = 'CONFIRMADA' | 'CANCELADA';

export interface ReservaClase {
  id: number;
  clase_id: number;
  socio_id: number;
  estado: EstadoReservaClase;
}

export type ReservaClaseNueva = Omit<ReservaClase, 'id'>;

// RF-07 (penalidad por cancelacion tardia): las clases NO tienen precio propio
// porque van incluidas en la membresia. La penalidad se calcula sobre un valor
// nominal de referencia (constante del dominio) y el porcentaje se aplica a este
// valor. Es la misma tecnica que PRECIOS_PLAN en M1: una unica fuente decidida
// por el equipo, sin tabla ni schema.
export const VALOR_REFERENCIA_CLASE_ARS = 10_000;
export const PORCENTAJE_PENALIDAD_CANCELACION_TARDIA = 0.5;

export function penalidadCancelacionTardia(): number {
  return VALOR_REFERENCIA_CLASE_ARS * PORCENTAJE_PENALIDAD_CANCELACION_TARDIA;
}

// Lo unico que M5 necesita para cobrar la penalidad y armar el comprobante:
// quien paga (usuario_id, el Pago referencia a Usuario), el horario de la clase y
// el importe. El cruce ReservaClase -> Clase -> Socio lo resuelve el service de
// precio de M3 (ReservaClasePrecioService).
export interface ReservaClaseParaCobro {
  reserva_clase_id: number;
  socio_id: number;
  usuario_id: number;
  clase_id: number;
  horario: string;
  penalidad: number;
}
