// CAPAS - M4 Canchas Deportivas. Igual estructura que m2
// (controllers/services/repositories/entities/dtos).
import { Module } from '@nestjs/common';
import { CommonsModule } from '../../commons/commons.module';
import { UsuariosModule } from '../m1-usuarios/usuarios.module';
import { GimnasioModule } from '../m2-gimnasio/gimnasio.module';
import { CanchasController } from './controllers/canchas.controller';
import { ReservasCanchasController } from './controllers/reservas-canchas.controller';
import { ReservaRepository } from './domain/reserva.port';
import { PricingStrategyFactory } from './pricing/pricing-strategy.factory';
import { CanchaRepository } from './repositories/cancha.repository';
import { PrismaReservaRepository } from './repositories/reserva.repository';
import { CanchasService } from './services/canchas.service';
import { DisponibilidadService } from './services/disponibilidad.service';
import { ReservasCanchasService } from './services/reservas-canchas.service';
import { ReservaPrecioService } from './services/reserva-precio.service';

// M4 depende de M1 (RN-03 al cotizar la tarifa bonificada) y de M2 (la sede de una
// cancha nueva debe existir). Exporta UNA sola cosa, `ReservaPrecioService`, para que
// M5 lea el precio congelado de una reserva por su propio caso de uso y no necesite
// los services de canchas: por eso existe un service aparte y no se exporta
// `ReservasCanchasService` entero, que ademas le abriria la puerta a crear y cancelar
// reservas desde M5.
@Module({
  imports: [CommonsModule, UsuariosModule, GimnasioModule],
  controllers: [CanchasController, ReservasCanchasController],
  providers: [
    CanchaRepository,
    // Puerto de dominio (Fowler) con su adaptador de Prisma: unica excepcion, junto
    // con MembresiaRepository de M1, a "repositorio = clase concreta".
    { provide: ReservaRepository, useClass: PrismaReservaRepository },
    CanchasService,
    DisponibilidadService,
    ReservasCanchasService,
    ReservaPrecioService,
    // Una sola clase: la cadena Standard -> MemberDiscount -> PeakHour se arma
    // adentro de la factory (pricing/ es dominio puro), no hay providers por estrategia.
    PricingStrategyFactory,
  ],
  exports: [ReservaPrecioService],
})
export class CanchasModule {}
