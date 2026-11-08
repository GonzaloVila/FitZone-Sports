import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import type { RolUsuario } from '../../modules/m1-usuarios/entities/usuario.entity';
import { ProblemException } from '../filters/problem.exception';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class ControllerSinRoles {
  libre() {}
}

class ControllerConRolEnMetodo {
  @Roles('GERENTE', 'RECEPCION')
  soloPersonal() {}

  sinMarca() {}
}

@Roles('GERENTE')
class ControllerDeGerente {
  heredaDeLaClase() {}

  @Roles('SOCIO')
  elMetodoManda() {}
}

// Arma el ExecutionContext que recibe el guard: el handler y la clase (para que el Reflector lea @Roles) y el request con
// el usuario que JwtAuthGuard dejaria en req.user.
function contexto(clase: new () => object, metodo: string, rol?: RolUsuario): ExecutionContext {
  const request = rol ? { user: { rol } } : {};
  return {
    getHandler: () => (clase.prototype as Record<string, () => void>)[metodo],
    getClass: () => clase,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function errorDe(fn: () => unknown): ProblemException {
  try {
    fn();
  } catch (error) {
    return error as ProblemException;
  }
  throw new Error('se esperaba que el guard rechazara el acceso');
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  describe('sin @Roles no exige ningun rol', () => {
    it('deja pasar a cualquier rol en un controller sin marca', () => {
      expect(guard.canActivate(contexto(ControllerSinRoles, 'libre', 'EXTERNO'))).toBe(true);
    });

    it('deja pasar aunque el request no traiga usuario (eso lo corta JwtAuthGuard antes)', () => {
      expect(guard.canActivate(contexto(ControllerSinRoles, 'libre'))).toBe(true);
    });

    it('un metodo sin marca de un controller que tiene otros metodos marcados queda libre', () => {
      expect(guard.canActivate(contexto(ControllerConRolEnMetodo, 'sinMarca', 'SOCIO'))).toBe(true);
    });
  });

  describe('con @Roles en el metodo', () => {
    it.each<RolUsuario>(['GERENTE', 'RECEPCION'])('deja pasar a %s, que esta en la lista', (rol) => {
      expect(guard.canActivate(contexto(ControllerConRolEnMetodo, 'soloPersonal', rol))).toBe(true);
    });

    it.each<RolUsuario>(['SOCIO', 'EXTERNO'])('rechaza a %s con un 403 en formato problem', (rol) => {
      const error = errorDe(() => guard.canActivate(contexto(ControllerConRolEnMetodo, 'soloPersonal', rol)));

      expect(error).toBeInstanceOf(ProblemException);
      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).toMatchObject({
        status: 403,
        title: 'Acceso prohibido',
        detail: 'No tiene permisos para acceder a este recurso.',
      });
    });

    it('rechaza un request sin usuario cuando el endpoint exige rol', () => {
      const error = errorDe(() => guard.canActivate(contexto(ControllerConRolEnMetodo, 'soloPersonal')));
      expect(error.getStatus()).toBe(403);
    });
  });

  describe('con @Roles en la clase', () => {
    it('el metodo sin marca hereda el rol de la clase', () => {
      expect(guard.canActivate(contexto(ControllerDeGerente, 'heredaDeLaClase', 'GERENTE'))).toBe(true);
      expect(errorDe(() => guard.canActivate(contexto(ControllerDeGerente, 'heredaDeLaClase', 'SOCIO'))).getStatus()).toBe(
        403,
      );
    });

    it('la marca del metodo pisa a la de la clase (getAllAndOverride)', () => {
      expect(guard.canActivate(contexto(ControllerDeGerente, 'elMetodoManda', 'SOCIO'))).toBe(true);
      expect(errorDe(() => guard.canActivate(contexto(ControllerDeGerente, 'elMetodoManda', 'GERENTE'))).getStatus()).toBe(
        403,
      );
    });
  });
});
