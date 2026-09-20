import { Module } from '@nestjs/common';
import { SociosController } from './controllers/socios.controller';
import { UsuariosController } from './controllers/usuarios.controller';
import { PrismaSocioRepository } from './repositories/prisma/prisma-socio.repository';
import { PrismaUsuarioRepository } from './repositories/prisma/prisma-usuario.repository';
import { SOCIO_REPOSITORY } from './repositories/socio.repository';
import { USUARIO_REPOSITORY } from './repositories/usuario.repository';
import { SociosService } from './services/socios.service';
import { UsuariosService } from './services/usuarios.service';

@Module({
  controllers: [UsuariosController, SociosController],
  providers: [
    { provide: USUARIO_REPOSITORY, useClass: PrismaUsuarioRepository },
    { provide: SOCIO_REPOSITORY, useClass: PrismaSocioRepository },
    UsuariosService,
    SociosService,
  ],
})
export class UsuariosModule {}
