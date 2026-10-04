import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CommonsModule } from '../../commons/commons.module';
import { UsuariosModule } from '../m1-usuarios/usuarios.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TotpService } from './services/totp.service';
import { JwtStrategy } from './strategies/jwt.strategy';

// Deuda tecnica #1 (login funcional + guards): login pide `UsuariosService`
// de M1 (mismo criterio ADR-09 que M2/M3/M4), y registra la JwtStrategy que
// JwtAuthGuard (commons/guards) usa para validar el token en cualquier otro
// modulo, sin que ese modulo necesite importar AuthModule.
//
// TotpService se exporta para M2 (GimnasioModule importa AuthModule): es el
// unico consumidor fuera de este modulo, para validar codigo_totp al
// registrar un ingreso (RF-04). El grafo queda M2 -> M1, Auth -> M1, sin
// ciclos, igual criterio que el resto (ADR-09).
@Module({
  imports: [
    CommonsModule,
    UsuariosModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<number>('JWT_EXPIRES_IN') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TotpService, JwtStrategy],
  exports: [TotpService],
})
export class AuthModule {}
