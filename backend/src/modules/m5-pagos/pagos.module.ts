// CAPAS - M5 Pagos y Facturación (RF-13, RF-14).
// Andamiaje en capas. El contrato declara cinco operaciones de pago; este bloque
// implementa la primera (`POST /pagos`) y deja las otras cuatro para los bloques
// siguientes, así que el tag `pagos` ya está en `main.ts` y el comparador de
// contrato empieza a medir el alcance real de M5 por rutas.
//
// La estructura replica M1-M4 a propósito:
//
//   pagos.module.ts
//   controllers/   dtos/   entities/   repositories/   services/
//
// Lo que sigue, en orden de dependencia:
//
// 1. `entities/pago.entity.ts` y `entities/solicitud-cobro.entity.ts` ya están:
//    `Pago`, `ConceptoPago`, `EstadoPago` y la frontera interna `SolicitudCobro` /
//    `ComprobanteDto` (que antes vivían en el puerto del Mediador).
// 2. `repositories/pago.repository.ts`: clase concreta con Prisma (no interfaz ni
//    token), siguiendo el criterio de M1-M4. Resuelve `Pago`, `PagoReserva` y
//    `PagoMembresia`, que ya existen en el schema.
// 3. `dtos/`: `PagoIn` (concepto + token + moneda), `PagoOut` y el query de listado
//    con `?desde`/`?hasta`, siguiendo el contrato.
// 4. `services/pagos.service.ts`: `procesarPago` es el caso de uso.
// 5. `services/comprobantes.service.ts` y `services/pasarela-pago.service.ts`: el PDF
//    (RF-14) y la llamada a la pasarela. Son services normales, no adapters de salida.
//    La pasarela es simulada (alcance académico) y detrás de `PasarelaPagoService`
//    para poder cambiar MercadoPago por otra sin tocar el service de pagos.
//
// SOBRE EL GRAFO. La dependencia va de M5 hacia M1 y M4, no al revés, y la razón es
// el monto: `PagoIn` (contrato) no lleva `monto` y `additionalProperties: false`, así
// que el cliente no puede mandarlo, y `PagoOut.monto` es required. Para que
// `POST /pagos` responda, alguien resuelve el importe, y como el llamador es HTTP ese
// alguien es M5. Con plan = precio congelado de la reserva, y con membresía = el
// precio de la fila Membresia.
//
// Por eso M5 importa estos dos módulos y NO al revés:
//   - `MembresiaPrecioService` (M1) → precio, plan y usuario de una membresía.
//   - `ReservaPrecioService` (M4) → precio congelado y usuario de una reserva.
//
// Son services angostos, no las entidades: cada módulo sigue siendo el único que
// consulta su tabla (ADR-07) y cada caso de uso expone lo mínimo que necesita.
//
// Lo que este diseño resigna, y es una decisión consciente: como M5 importa M1 y M4,
// ni M1 ni M4 pueden importar `PagosModule` sin cerrar un ciclo. Por eso en esta
// pasada el único camino de cobro es `POST /pagos` por HTTP, y la renovación
// automática de RF-02 no es un cron en M1 sino un cron en M5
// (`crons/renovaciones.cron.ts`), que ya está del lado correcto del grafo. La
// RF-02 se cierra igual; lo que no se hace todavía es que el alta de un socio o la
// creación de una reserva disparen el cobro internamente.

import { Module } from '@nestjs/common';
import { CanchasModule } from '../m4-canchas/canchas.module';
import { UsuariosModule } from '../m1-usuarios/usuarios.module';
import { RenovacionesCron } from './crons/renovaciones.cron';
import { PagosController } from './controllers/pagos.controller';
import { PagoRepository } from './repositories/pago.repository';
import { ComprobantesService } from './services/comprobantes.service';
import { PagosService } from './services/pagos.service';
import { PasarelaPagoService } from './services/pasarela-pago.service';
import { RenovacionesListener } from './services/renovaciones.listener';
import { RenovacionesService } from './services/renovaciones.service';

// M5 no exporta nada todavía. Cuando exista el camino interno de cobro va a exportar
// `PagosService`, pero mientras el único llamador sea HTTP no hay nada que compartir.
// Los `.gitkeep` de las carpetas se pueden borrar ahora: cada una tiene su archivo.
//
// RF-02: además del cobro por HTTP, M5 tiene el cobro interno de membresía. El
// `RenovacionesListener` escucha los eventos que emite M1 (alta de socio, cambio de
// plan sobre membresía no vigente) y `RenovacionesCron` renueva a medianoche las
// membresías con renovación automática. Ambos usan `RenovacionesService`, que cobra
// primero y solo inserta el Pago si la pasarela aprobó.
@Module({
  imports: [UsuariosModule, CanchasModule],
  controllers: [PagosController],
  providers: [
    PagoRepository,
    PasarelaPagoService,
    ComprobantesService,
    PagosService,
    RenovacionesService,
    RenovacionesListener,
    RenovacionesCron,
  ],
})
export class PagosModule {}