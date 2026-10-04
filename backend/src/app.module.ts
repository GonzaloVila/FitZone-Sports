import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.config';
import { CommonsModule } from './commons/commons.module';
import { DatabaseModule } from './commons/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/m1-usuarios/usuarios.module';
import { GimnasioModule } from './modules/m2-gimnasio/gimnasio.module';
import { ClasesModule } from './modules/m3-clases/clases.module';
import { CanchasModule } from './modules/m4-canchas/canchas.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    DatabaseModule,
    CommonsModule,
    AuthModule,
    UsuariosModule,
    GimnasioModule,
    ClasesModule,
    CanchasModule,
  ],
})
export class AppModule {}