// CAPAS - M2 Gimnasio y Acceso (RF-04, RF-05).
// Igual estructura que m1 (controllers/services/repositories/prisma/entities/dtos).
import { Module } from '@nestjs/common';
import { CommonsModule } from '../../commons/commons.module';
import { UsuariosModule } from '../m1-usuarios/usuarios.module';
import { IngresosController } from './controllers/ingresos.controller';
import { SedesController } from './controllers/sedes.controller';
import { PrismaIngresoRepository } from './repositories/prisma/prisma-ingreso.repository';
import { PrismaSedeRepository } from './repositories/prisma/prisma-sede.repository';
import { INGRESO_REPOSITORY } from './repositories/ingreso.repository';
import { SEDE_REPOSITORY } from './repositories/sede.repository';
import { IngresosService } from './services/ingresos.service';
import { SedesService } from './services/sedes.service';

@Module({
  // Importa UsuariosModule solo para acceder a MEMBERSHIP_VALIDATION_PORT
  // (exportado por M1): M2 nunca importa SOCIO_REPOSITORY ni
  // MEMBRESIA_REPOSITORY directamente (aislamiento entre módulos, ADR-07).
  imports: [CommonsModule, UsuariosModule],
  controllers: [SedesController, IngresosController],
  providers: [
    { provide: SEDE_REPOSITORY, useClass: PrismaSedeRepository },
    { provide: INGRESO_REPOSITORY, useClass: PrismaIngresoRepository },
    SedesService,
    IngresosService,
  ],
})
export class GimnasioModule {}
