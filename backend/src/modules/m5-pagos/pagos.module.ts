// CAPAS - M5 Pagos y Facturación (RF-13, RF-14).
// Andamiaje en capas, sin endpoints todavía: el contrato declara cinco
// operaciones de pago y el backend aún no expone ninguna, así que acá solo está
// la estructura y el dominio, no el comportamiento.
//
// Por qué no hay controllers todavía: el comparador de contrato calcula el
// alcance por rutas, no por tags. Agregar el tag `pagos` sin implementar sus
// cinco operaciones no cambia nada para el comparador, y escribir un controller
// a medias publicaría rutas que el contrato todavia no describe igual.
//
// La estructura replica M1-M4 a proposito:
//
//   pagos.module.ts
//   controllers/   dtos/   entities/   repositories/   services/
//
// Lo que sigue, en orden de dependencia:
//
// 1. `entities/pago.entity.ts` ya esta: `Pago`, `ConceptoPago`, `EstadoPago`.
// 2. `repositories/pago.repository.ts`: clase concreta con Prisma (no interfaz
//    ni token), siguiendo el criterio de M1-M4. Resuelve `Pago`, `PagoReserva` y
//    `PagoMembresia`, que ya existen en el schema.
// 3. `dtos/`: `PagoIn` (concepto + token + moneda), `PagoOut` y el query de
//    listado con `?desde`/`?hasta`, siguiendo el contrato.
// 4. `services/pagos.service.ts`: `procesarPago` es el caso de uso. El monto no
//    llega del cliente: lo computa la regla de negocio del módulo que origina el
//    cobro (el precio congelado de la reserva en M4, o el plan de la membresía en
//    M1). El service de M5 no vuelve a mirar esas tablas; recibe el monto
//    resuelto desde el service de M1/M4 y lo congela en el pago.
// 5. `services/comprobantes.service.ts` y `services/pasarela-pago.service.ts`:
//    el PDF (RF-14) y la llamada a la pasarela. Son services normales, no
//    adapters de salida. La pasarela es simulada (alcance académico) y detrás de
//    `PasarelaPagoService` para poder cambiar MercadoPago por otra sin tocar el
//    service de pagos.
//
// Sobre el grafo: M5 importa M1 y M4, no al revés. Cuando M1 (RF-02) o M4 (RF-13)
// disparar un cobro, lo hacen llamando al service de M5, y ese service resuelve
// el monto contra el módulo de origen. No hace falta el Mediador: el
// desacople que aportaba era evitar la dependencia M1 -> M5, y con capas la
// dependencia entre módulos es explícita y está en el `imports` del módulo.

import { Module } from '@nestjs/common';

@Module({})
export class PagosModule {}
