// CAPAS - M4 Canchas Deportivas. Igual estructura que m2
// (controllers/services/repositories/prisma/entities/dtos).
import { Module } from '@nestjs/common';
import { CommonsModule } from '../../commons/commons.module';
import { CanchasController } from './controllers/canchas.controller';
import { PrismaCanchaRepository } from './repositories/prisma/prisma-cancha.repository';
import { CANCHA_REPOSITORY } from './repositories/cancha.repository';
import { CanchasService } from './services/canchas.service';

@Module({
  // M4 NO importa M2. SEDE_VALIDATION_PORT se inyecta porque GimnasioModule
  // es @Global() y su array exports lo publica explicitamente; M4 nunca ve
  // SEDE_REPOSITORY ni SedesService de M2 directamente (aislamiento entre
  // modulos de dominio, ADR-07, C4; mismo patrón que M2 con M1, Bloque 0).
  imports: [CommonsModule],
  controllers: [CanchasController],
  providers: [
    { provide: CANCHA_REPOSITORY, useClass: PrismaCanchaRepository },
    CanchasService,
  ],
})
export class CanchasModule {}
