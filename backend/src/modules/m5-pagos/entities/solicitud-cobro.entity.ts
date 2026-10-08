// CAPAS - M5 Pagos y Facturación (RF-13, RF-14).
// Frontera interna entre M1/M4 y M5. Antes vivía en el puerto
// `commons/mediador/procesar-pago.port.ts`; al eliminar el Mediador estos tipos
// pasaron al dominio del módulo que los resuelve.
//
// No son los DTOs HTTP, y la diferencia es el monto:
//   - `PagoIn` (contrato) no lleva `monto`: el cliente manda concepto + token y
//     el importe lo computa la regla de negocio.
//   - `SolicitudCobro` ya viaja con el monto resuelto, porque lo resolvió el
//     service del módulo que origina el cobro (el precio congelado de la reserva
//     en M4, o el plan de la membresía en M1) y M5 lo congela tal cual.
// Para el resto se reutilizan los tipos de `pago.entity.ts` en vez de duplicar
// el mismo vocabulario con otro nombre.
//
// `ComprobanteDto` es la respuesta del caso de uso: identificador del
// comprobante y fecha de creación, en lugar del `id`/`fecha_pago` de `PagoOut`.

import type { ConceptoPago, EstadoPago } from './pago.entity';

// Qué módulo origina el cobro. `RENOVACION` distingue la renovación automática
// de la renovación que pide el socio.
export type OrigenCobro = 'M1' | 'M4' | 'RENOVACION';

export interface SolicitudCobro {
  moduloOrigen: OrigenCobro;
  concepto: ConceptoPago;
  detalle: string;
  // Ya resuelto por el módulo de origen: M5 no vuelve a mirar esas tablas.
  monto: number;
  moneda: string;
  // La pasarela es idempotente por clave: repetir la misma clave devuelve el
  // pago original en vez de cobrar dos veces.
  idempotenciaKey: string;
}

export interface ComprobanteDto {
  idPago: string;
  estado: EstadoPago;
  // RNF-02: solo el token emitido por la pasarela, nunca la tarjeta.
  token: string;
  monto: number;
  moneda: string;
  comprobantePdfUrl: string | null;
  creadoEn: string;
}
