import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonsModule } from '../../commons/commons.module';
import { MEMBERSHIP_VALIDATION_PORT } from '../../commons/membresia/membership-validation.port';
import { MembresiaValidationAdapter } from './adapters/membresia-validation.adapter';
import { MembresiasController } from './controllers/membresias.controller';
import { SociosController } from './controllers/socios.controller';
import { UsuariosController } from './controllers/usuarios.controller';
import { MembresiasCron } from './crons/membresias.cron';
import { PrismaMembresiaRepository } from './repositories/prisma/prisma-membresia.repository';
import { PrismaSocioRepository } from './repositories/prisma/prisma-socio.repository';
import { PrismaUsuarioRepository } from './repositories/prisma/prisma-usuario.repository';
import { MEMBRESIA_REPOSITORY } from './repositories/membresia.repository';
import { SOCIO_REPOSITORY } from './repositories/socio.repository';
import { USUARIO_REPOSITORY } from './repositories/usuario.repository';
import { MembresiasService } from './services/membresias.service';
import { SociosService } from './services/socios.service';
import { UsuariosService } from './services/usuarios.service';

// @Global + exports acotado: publica el contrato de M1 hacia el resto de la app
// sin que ningun modulo de dominio tenga que importarlo (C4, ADR-07).
@Global()
@Module({
  imports: [CommonsModule, ScheduleModule.forRoot()],
  controllers: [UsuariosController, SociosController, MembresiasController],
  providers: [
    { provide: USUARIO_REPOSITORY, useClass: PrismaUsuarioRepository },
    { provide: SOCIO_REPOSITORY, useClass: PrismaSocioRepository },
    { provide: MEMBRESIA_REPOSITORY, useClass: PrismaMembresiaRepository },
    { provide: MEMBERSHIP_VALIDATION_PORT, useClass: MembresiaValidationAdapter },
    UsuariosService,
    SociosService,
    MembresiasService,
    MembresiasCron,
  ],
  // El array exports es el filtro de @Global(): de todo M1 sale unicamente
  // MEMBERSHIP_VALIDATION_PORT. USUARIO_REPOSITORY, SOCIO_REPOSITORY,
  // MEMBRESIA_REPOSITORY y los services siguen privados para el resto de la app.
  // M5 aplicara la misma regla con PROCESAR_PAGO_PORT en ModuloPagos.
  exports: [MEMBERSHIP_VALIDATION_PORT],
})
export class UsuariosModule {}
