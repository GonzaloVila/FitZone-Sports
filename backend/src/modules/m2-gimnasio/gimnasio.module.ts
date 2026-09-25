// CAPAS - M2 Gimnasio y Acceso (RF-04, RF-05).
// Igual estructura que m1 (controllers/services/repositories/prisma/entities/dtos).
import { Global, Module } from '@nestjs/common';
import { CommonsModule } from '../../commons/commons.module';
import { SEDE_VALIDATION_PORT } from '../../commons/sede/sede-validation.port';
import { SedeValidationAdapter } from './adapters/sede-validation.adapter';
import { IngresosController } from './controllers/ingresos.controller';
import { SedesController } from './controllers/sedes.controller';
import { PrismaIngresoRepository } from './repositories/prisma/prisma-ingreso.repository';
import { PrismaSedeRepository } from './repositories/prisma/prisma-sede.repository';
import { INGRESO_REPOSITORY } from './repositories/ingreso.repository';
import { SEDE_REPOSITORY } from './repositories/sede.repository';
import { IngresosService } from './services/ingresos.service';
import { SedesService } from './services/sedes.service';

// @Global + exports acotado (mismo patrón que UsuariosModule, ADR-07): publica
// SEDE_VALIDATION_PORT hacia M4 sin que M4 importe GimnasioModule ni vea
// SEDE_REPOSITORY/SedesService directamente.
@Global()
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
    { provide: SEDE_VALIDATION_PORT, useClass: SedeValidationAdapter },
    SedesService,
    IngresosService,
  ],
  // El array exports es el filtro de @Global(): de todo M2 sale unicamente
  // SEDE_VALIDATION_PORT. SEDE_REPOSITORY, INGRESO_REPOSITORY y los services
  // siguen privados para el resto de la app.
  exports: [SEDE_VALIDATION_PORT],
})
export class GimnasioModule {}
