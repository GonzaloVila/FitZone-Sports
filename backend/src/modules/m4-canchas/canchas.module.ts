// CAPAS - M4 Canchas Deportivas. Igual estructura que m2
// (controllers/services/repositories/entities/dtos).
import { Module } from '@nestjs/common';
import { CommonsModule } from '../../commons/commons.module';
import { UsuariosModule } from '../m1-usuarios/usuarios.module';
import { GimnasioModule } from '../m2-gimnasio/gimnasio.module';
import { CanchasController } from './controllers/canchas.controller';
import { ReservasCanchasController } from './controllers/reservas-canchas.controller';
import { PricingStrategyFactory } from './pricing/pricing-strategy.factory';
import { CanchaRepository } from './repositories/cancha.repository';
import { ReservaRepository } from './repositories/reserva.repository';
import { CanchasService } from './services/canchas.service';
import { DisponibilidadService } from './services/disponibilidad.service';
import { ReservasCanchasService } from './services/reservas-canchas.service';

// M4 depende de M1 (RN-03 al cotizar la tarifa bonificada) y de M2 (la sede de una
// cancha nueva debe existir). No exporta nada: M5 consume los servicios por sus
// propios casos de uso, no la capa de datos de las canchas.
@Module({
  imports: [CommonsModule, UsuariosModule, GimnasioModule],
  controllers: [CanchasController, ReservasCanchasController],
  providers: [
    CanchaRepository,
    ReservaRepository,
    CanchasService,
    DisponibilidadService,
    ReservasCanchasService,
    // Una sola clase: la cadena Standard -> MemberDiscount -> PeakHour se arma
    // adentro de la factory (pricing/ es dominio puro), no hay providers por estrategia.
    PricingStrategyFactory,
  ],
})
export class CanchasModule {}
