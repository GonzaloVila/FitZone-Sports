import { Module } from '@nestjs/common';
import { CommonsModule } from '../../commons/commons.module';
import { MembresiasController } from './controllers/membresias.controller';
import { SociosController } from './controllers/socios.controller';
import { UsuariosController } from './controllers/usuarios.controller';
import { PrismaMembresiaRepository } from './repositories/prisma/prisma-membresia.repository';
import { PrismaSocioRepository } from './repositories/prisma/prisma-socio.repository';
import { PrismaUsuarioRepository } from './repositories/prisma/prisma-usuario.repository';
import { MEMBRESIA_REPOSITORY } from './repositories/membresia.repository';
import { SOCIO_REPOSITORY } from './repositories/socio.repository';
import { USUARIO_REPOSITORY } from './repositories/usuario.repository';
import { MembresiasService } from './services/membresias.service';
import { SociosService } from './services/socios.service';
import { UsuariosService } from './services/usuarios.service';

@Module({
  imports: [CommonsModule],
  controllers: [UsuariosController, SociosController, MembresiasController],
  providers: [
    { provide: USUARIO_REPOSITORY, useClass: PrismaUsuarioRepository },
    { provide: SOCIO_REPOSITORY, useClass: PrismaSocioRepository },
    { provide: MEMBRESIA_REPOSITORY, useClass: PrismaMembresiaRepository },
    UsuariosService,
    SociosService,
    MembresiasService,
  ],
})
export class UsuariosModule {}
