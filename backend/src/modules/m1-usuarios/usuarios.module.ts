import { Module } from '@nestjs/common';
import { UsuariosController } from './controllers/usuarios.controller';
import { PrismaUsuarioRepository } from './repositories/prisma/prisma-usuario.repository';
import { USUARIO_REPOSITORY } from './repositories/usuario.repository';
import { UsuariosService } from './services/usuarios.service';

@Module({
  controllers: [UsuariosController],
  providers: [
    { provide: USUARIO_REPOSITORY, useClass: PrismaUsuarioRepository },
    UsuariosService,
  ],
})
export class UsuariosModule {}