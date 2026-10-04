import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GENERIC_TYPE, ProblemException, TITLES } from '../filters/problem.exception';
import type { RolUsuario } from '../../modules/m1-usuarios/entities/usuario.entity';
import { ROLES_KEY } from './roles.decorator';
import type { UsuarioAutenticado } from '../../modules/auth/strategies/jwt.strategy';

interface RequestConUsuario {
  user?: UsuarioAutenticado;
}

// Verifica que el rol del usuario autenticado (lo deja JwtAuthGuard, que debe
// correr antes) tenga permiso para el endpoint segun @Roles(...). Sin
// @Roles(...) en el handler/controller, no exige ningun rol.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<RolUsuario[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestConUsuario>();
    const rol = request.user?.rol;

    if (!rol || !rolesRequeridos.includes(rol)) {
      throw new ProblemException({
        type: GENERIC_TYPE,
        title: TITLES[HttpStatus.FORBIDDEN],
        status: HttpStatus.FORBIDDEN,
        detail: 'No tiene permisos para acceder a este recurso.',
      });
    }

    return true;
  }
}
