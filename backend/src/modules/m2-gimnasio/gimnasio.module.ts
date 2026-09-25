// CAPAS - M2 Gimnasio y Acceso (RF-04, RF-05).
// Igual estructura que m1 (controllers/services/repositories/prisma/entities/dtos).
import { Module } from '@nestjs/common';
import { CommonsModule } from '../../commons/commons.module';
import { IngresosController } from './controllers/ingresos.controller';
import { SedesController } from './controllers/sedes.controller';
import { PrismaIngresoRepository } from './repositories/prisma/prisma-ingreso.repository';
import { PrismaSedeRepository } from './repositories/prisma/prisma-sede.repository';
import { INGRESO_REPOSITORY } from './repositories/ingreso.repository';
import { SEDE_REPOSITORY } from './repositories/sede.repository';
import { IngresosService } from './services/ingresos.service';
import { SedesService } from './services/sedes.service';

@Module({
  // M2 NO importa M1. MEMBERSHIP_VALIDATION_PORT se inyecta porque
  // UsuariosModule es @Global() y su array exports lo publica explicitamente;
  // M2 nunca ve SOCIO_REPOSITORY, MEMBRESIA_REPOSITORY ni USUARIO_REPOSITORY
  // (aislamiento entre modulos de dominio, ADR-07, C4).
  imports: [CommonsModule],
  controllers: [SedesController, IngresosController],
  providers: [
    { provide: SEDE_REPOSITORY, useClass: PrismaSedeRepository },
    { provide: INGRESO_REPOSITORY, useClass: PrismaIngresoRepository },
    SedesService,
    IngresosService,
  ],
})
export class GimnasioModule {}
