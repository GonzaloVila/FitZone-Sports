import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.config';
import { CommonsModule } from './commons/commons.module';
import { DatabaseModule } from './commons/database/database.module';
import { UsuariosModule } from './modules/m1-usuarios/usuarios.module';
import { GimnasioModule } from './modules/m2-gimnasio/gimnasio.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    DatabaseModule,
    CommonsModule,
    UsuariosModule,
    GimnasioModule,
  ],
})
export class AppModule {}