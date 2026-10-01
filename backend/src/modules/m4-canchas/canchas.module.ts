// CAPAS - M4 Canchas Deportivas. Igual estructura que m2
// (controllers/services/repositories/prisma/entities/dtos).
import { Module } from '@nestjs/common';
import { CommonsModule } from '../../commons/commons.module';
import { GimnasioModule } from '../m2-gimnasio/gimnasio.module';
import { UsuariosModule } from '../m1-usuarios/usuarios.module';
import { CanchasController } from './controllers/canchas.controller';
import { ReservasCanchasController } from './controllers/reservas-canchas.controller';
import { PricingStrategyFactory } from './pricing/pricing-strategy.factory';
import { PrismaCanchaRepository } from './repositories/prisma/prisma-cancha.repository';
import { PrismaReservaRepository } from './repositories/prisma/prisma-reserva.repository';
import { CANCHA_REPOSITORY } from './repositories/cancha.repository';
import { RESERVA_REPOSITORY } from './repositories/reserva.repository';
import { CanchasService } from './services/canchas.service';
import { DisponibilidadService } from './services/disponibilidad.service';
import { ReservasCanchasService } from './services/reservas-canchas.service';

@Module({
  // M4 importa M1 por `MembresiasService` (RN-03 al cotizar la tarifa bonificada)
  // y M2 por `SedesService` (la sede de una cancha nueva debe existir).
  imports: [CommonsModule, UsuariosModule, GimnasioModule],
  controllers: [CanchasController, ReservasCanchasController],
  providers: [
    { provide: CANCHA_REPOSITORY, useClass: PrismaCanchaRepository },
    { provide: RESERVA_REPOSITORY, useClass: PrismaReservaRepository },
    CanchasService,
    DisponibilidadService,
    ReservasCanchasService,
    // Una sola clase: la cadena Standard -> MemberDiscount -> PeakHour se arma
    // adentro de la factory (pricing/ es dominio puro), no hay providers por estrategia.
    PricingStrategyFactory,
  ],
})
export class CanchasModule {}
