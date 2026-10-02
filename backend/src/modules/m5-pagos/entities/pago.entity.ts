// CAPAS - M5 Pagos y Facturación (RF-13, RF-14).
// Estructura igual que M1-M4: controllers/services/repositories/entities/dtos.
//
// Antes este módulo tenía una estructura hexagonal (domain/ports/in,
// infrastructure/adapters/out, application/use-cases) y su entrada era
// `commons/mediador/`. Con la migración a capas:
//   - la entrada es HTTP por los controllers, y entre M1/M4 y M5 el
//     acoplamiento es directo: M1/M4 importan `PagosModule` y llaman a
//     `PagosService`, así que M5 no importa M1 ni M4 y el grafo sigue acíclico;
//   - la pasarela de pago y el PDF son collaborators del service, no adapters.
//
// Estos tipos son el dominio del pago y adoptan el vocabulario del contrato
// (`Pago`, `PagoOut`, `ConceptoPago`, `EstadoPago`) para que la traducción sea
// literal. La frontera interna entre módulos vive en `solicitud-cobro.entity.ts`.

export type EstadoPago = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'ANULADO';

// Un pago referencia estructuralmente UN solo concepto (reserva de cancha o
// membresía, herencia parte-todo). Es la discriminated union del contrato
// `ConceptoPago`: el `tipo` decide cuál id viene poblado.
export type ConceptoPago =
  | { tipo: 'RESERVA_CANCHA'; reserva_cancha_id: number }
  | { tipo: 'MEMBRESIA'; membresia_id: number };

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
