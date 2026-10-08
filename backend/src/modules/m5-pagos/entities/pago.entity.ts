// CAPAS - M5 Pagos y Facturación (RF-13, RF-14).
// Estructura igual que M1-M4: controllers/services/repositories/entities/dtos.
//
// Antes este módulo tenía una estructura hexagonal (domain/ports/in,
// infrastructure/adapters/out, application/use-cases) y su entrada era
// `commons/mediador/`. Con la migración a capas:
//   - la entrada es HTTP por los controllers;
//   - la pasarela de pago y el PDF son collaborators del service, no adapters;
//   - M5 importa M1 y M4 para leer el precio del concepto, porque el monto es lo
//     único que `POST /pagos` tiene que resolver en el servidor y el cliente no
//     lo manda. Ver `pagos.module.ts` para el grafo y lo que ese diseño resigna.
//
// Estos tipos son el dominio del pago y adoptan el vocabulario del contrato
// (`Pago`, `PagoOut`, `ConceptoPago`, `EstadoPago`) para que la traducción sea
// literal. La frontera interna entre módulos vive en `solicitud-cobro.entity.ts`.

export type EstadoPago = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'ANULADO';

// Un pago referencia estructuralmente UN solo concepto (reserva de cancha,
// membresía o penalidad de clase, herencia parte-todo). Es la discriminated union
// del contrato `ConceptoPago`: el `tipo` decide cuál id viene poblado.
export type ConceptoPago =
  | { tipo: 'RESERVA_CANCHA'; reserva_cancha_id: number }
  | { tipo: 'MEMBRESIA'; membresia_id: number }
  | { tipo: 'RESERVA_CLASE'; reserva_clase_id: number };

export interface Pago {
  id: number;
  usuario_id: number;
  concepto: ConceptoPago;
  monto: number;
  moneda: string;
  estado: EstadoPago;
  fecha_pago: Date;
  comprobante_pdf_url: string | null;
  // RNF-02: se guarda solo el token emitido por la pasarela, nunca la tarjeta.
  token: string;
  // La pasarela es idempotente por clave: repetir la misma clave devuelve el
  // pago original en vez de cobrar dos veces (ver `Pago.idempotencia_key`).
  idempotencia_key: string;
}

/**
 * El pago tal como lo arma el service antes de insertarlo. No lleva `id` ni
 * `estado` a propósito:
 *
 *  - `estado` se escribe SIEMPRE explícito y arrancando en `PENDIENTE` (decisión 7
 *    del plan). `Pago.estado` no tiene `@default` en el schema justamente para que
 *    un cobro sin resultado explícito de la pasarela no termine persistido como
 *    lo que saliera de la base.
 *  - `monto` viene resuelto de M1/M4, nunca del cliente (decisión 4).
 */
export interface PagoNuevo {
  usuario_id: number;
  concepto: ConceptoPago;
  monto: number;
  moneda: string;
  token: string;
  idempotencia_key: string;
}

/**
 * La anulación se pide sobre el pago, no sobre un id suelto.
 *
 * El service necesita `token`, `monto` y `moneda` para pedirle la devolución a la
 * pasarela (una devolución sin el token original no se puede hacer), y el
 * repositorio usa `id` como filtro del propio UPDATE junto con el estado. El tipo
 * nombra esa unidad de dominio en vez de repetir un `number` suelto por los tres
 * métodos que participan de la anulación.
 *
 * No lleva `estado`: cuál es anulable lo decide el service leyendo el pago
 * (idempotencia del 204, 409 del RECHAZADO) y el repositorio solo escribe.
 */
export interface PagoAAnular {
  id: number;
  token: string;
  monto: number;
  moneda: string;
}