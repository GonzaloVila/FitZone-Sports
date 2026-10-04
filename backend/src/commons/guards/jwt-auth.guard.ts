import { HttpStatus, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GENERIC_TYPE, ProblemException, TITLES } from '../filters/problem.exception';

// Valida que el JWT sea valido y no haya expirado (delega en JwtStrategy, que
// hace la verificacion de firma y exp). Se sobreescribe handleRequest para que
// un token ausente/invalido/vencido responda problem+json en espanol en vez
// del "Unauthorized" en ingles que tira @nestjs/passport por default.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser | false): TUser {
    if (err || !user) {
      throw new ProblemException({
        type: GENERIC_TYPE,
        title: TITLES[HttpStatus.UNAUTHORIZED],
        status: HttpStatus.UNAUTHORIZED,
        detail: 'El token es inválido, expiró o no fue provisto.',
      });
    }
    return user;
  }
}
