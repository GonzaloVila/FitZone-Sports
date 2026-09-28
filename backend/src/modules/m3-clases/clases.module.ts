import { Module, OnModuleInit } from '@nestjs/common';
import { CommonsModule } from '../../commons/commons.module';
import { ClasesController } from './controllers/clases.controller';
import { EsperasClasesController } from './controllers/esperas-clases.controller';
import { ReservasClasesController } from './controllers/reservas-clases.controller';
import { CupoLiberadoSubject } from './observers/cupo-liberado.subject';
import { NotificarSociosEsperaObserver } from './observers/notificar-socios-espera.observer';
import { CLASE_REPOSITORY } from './repositories/clase.repository';
import { ESPERA_CLASE_REPOSITORY } from './repositories/espera-clase.repository';
import { PrismaClaseRepository } from './repositories/prisma/prisma-clase.repository';
import { PrismaEsperaClaseRepository } from './repositories/prisma/prisma-espera-clase.repository';
import { PrismaReservaClaseRepository } from './repositories/prisma/prisma-reserva-clase.repository';
import { RESERVA_CLASE_REPOSITORY } from './repositories/reserva-clase.repository';
import { ClasesService } from './services/clases.service';
import { EsperasClasesService } from './services/esperas-clases.service';
import { ReservasClasesService } from './services/reservas-clases.service';

@Module({
  imports: [CommonsModule],
  controllers: [
    ClasesController,
    ReservasClasesController,
    EsperasClasesController,
  ],
  providers: [
    { provide: CLASE_REPOSITORY, useClass: PrismaClaseRepository },
    { provide: RESERVA_CLASE_REPOSITORY, useClass: PrismaReservaClaseRepository },
    { provide: ESPERA_CLASE_REPOSITORY, useClass: PrismaEsperaClaseRepository },
    ClasesService,
    ReservasClasesService,
    EsperasClasesService,
    CupoLiberadoSubject,
    NotificarSociosEsperaObserver,
  ],
  exports: [CLASE_REPOSITORY, RESERVA_CLASE_REPOSITORY, ESPERA_CLASE_REPOSITORY],
})
export class ClasesModule implements OnModuleInit {
  constructor(
    private readonly cupoSubject: CupoLiberadoSubject,
    private readonly notificarEsperaObserver: NotificarSociosEsperaObserver,
  ) {}

  onModuleInit(): void {
    // Registro de observadores en el Subject GoF al inicializar el módulo
    this.cupoSubject.registrarObserver(this.notificarEsperaObserver);
  }
}