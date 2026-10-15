import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { validateEnv } from 'src/config/env.config';
import { DatabaseModule } from 'src/commons/database/database.module';

// Arma el modulo de un test de integracion: la infraestructura global que en la app
// aporta AppModule (Config + Database/@Global PrismaService + EventEmitter) + los
// modulos de feature que se quieran probar. NO bootea el AppModule completo ni HTTP.
//
// `validate: validateEnv` es obligatorio, igual que en AppModule: es quien aporta los
// DEFAULTS de JWT_SECRET/JWT_EXPIRES_IN/TOTP_ENCRYPTION_KEY. Sin el, AuthModule (que
// arrastra GimnasioModule) revienta al construir JwtStrategy con "requires a secret".
export async function crearModuloDeIntegracion(...modulos: unknown[]): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
      DatabaseModule,
      EventEmitterModule.forRoot(),
      ...(modulos as never[]),
    ],
  }).compile();
}
