import type { InjectionToken } from "@nestjs/common";

export const PROCESAR_PAGO_PORT: InjectionToken = "PROCESAR_PAGO_PORT";

export type OrigenCobro = "M1" | "M4" | "RENOVACION";
export type ConceptoCobro = "MEMBRESIA" | "RESERVA";
export type EstadoComprobante =
  | "PENDIENTE"
  | "APROBADO"
  | "RECHAZADO"
  | "ANULADO";

export interface SolicitudCobro {
  modulo_origen: OrigenCobro;
  concepto_tipo: ConceptoCobro;
  concepto_id: number;
  detalle: string;
  monto: number;
  moneda: string;
  idempotencia_key: string;
}

export interface ComprobanteDto {
  id_pago: string;
  estado: EstadoComprobante;
  token: string;
  monto: number;
  moneda: string;
  comprobante_pdf_url: string | null;
  creado_en: string;
}

export interface ProcesarPagoPort {
  ejecutar(solicitud: SolicitudCobro): Promise<ComprobanteDto>;
}