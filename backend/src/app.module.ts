import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { validateEnv } from './config/env.config';
import { CommonsModule } from './commons/commons.module';
import { DatabaseModule } from './commons/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/m1-usuarios/usuarios.module';
import { GimnasioModule } from './modules/m2-gimnasio/gimnasio.module';
import { ClasesModule } from './modules/m3-clases/clases.module';
import { CanchasModule } from './modules/m4-canchas/canchas.module';
import { PagosModule } from './modules/m5-pagos/pagos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Global y síncrono: M1 emite (alta de socio, cambio de plan) y M5 escucha
    // para cobrar sin que M1 importe a M5 (el grafo es M5 → M1, sin ciclos).
    // `emitAsync` se usa desde M1 para esperar el resultado del listener y
    // propagar un rechazo de la pasarela como fallo del alta/cambio.
    EventEmitterModule.forRoot(),
    DatabaseModule,
    CommonsModule,
    AuthModule,
    UsuariosModule,
    GimnasioModule,
    ClasesModule,
    CanchasModule,
    PagosModule,
  ],
})
export class AppModule {}