import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { RolUsuario } from '../../m1-usuarios/entities/usuario.entity';

// Forma del payload firmado por AuthService.login(). sede_id solo esta
// presente para RECEPCION (ver nota del plan).
export interface JwtPayload {
  sub: number;
  rol: RolUsuario;
  sede_id?: number;
  iat: number;
  exp: number;
}

// Lo que queda en request.user tras pasar el JwtAuthGuard.
export interface UsuarioAutenticado {
  userId: number;
  rol: RolUsuario;
  sede_id?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  // Passport ya verifico firma y exp antes de llegar aca (ignoreExpiration:
  // false); validate() solo traduce el payload a lo que el resto de la app
  // consume como request.user.
  validate(payload: JwtPayload): UsuarioAutenticado {
    return { userId: payload.sub, rol: payload.rol, sede_id: payload.sede_id };
  }
}
