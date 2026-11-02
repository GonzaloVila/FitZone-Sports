import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProblemException } from '../filters/problem.exception';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';

class ControllerAbierto {
  @Public()
  abierta() {}

  cerradaPorDefecto() {}
}

@Public()
class ControllerPublicoEntero {
  cualquiera() {}
}

class ControllerCerrado {
  sinMarca() {}
}

function contexto(clase: new () => object, metodo: string): ExecutionContext {
  return {
    getHandler: () => (clase.prototype as Record<string, () => void>)[metodo],
    getClass: () => clase,
  } as unknown as ExecutionContext;
}

// AuthGuard('jwt') es un mixin: su canActivate (el que valida el token con passport) vive en el prototipo padre. Se espia
// ahi para saber si el guard llego a exigir sesion sin armar passport ni la base.
function espiarValidacionDeToken() {
  const padre = Object.getPrototypeOf(JwtAuthGuard.prototype) as { canActivate: () => boolean };
  return vi.spyOn(padre, 'canActivate').mockReturnValue(true);
}

describe('JwtAuthGuard (guard global)', () => {
  const guard = new JwtAuthGuard(new Reflector());

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deja pasar una ruta @Public() sin validar el token', () => {
    const validar = espiarValidacionDeToken();

    expect(guard.canActivate(contexto(ControllerAbierto, 'abierta'))).toBe(true);
    expect(validar).not.toHaveBeenCalled();
  });

  it('deja pasar todo un controller marcado @Public() a nivel de clase', () => {
    const validar = espiarValidacionDeToken();

    expect(guard.canActivate(contexto(ControllerPublicoEntero, 'cualquiera'))).toBe(true);
    expect(validar).not.toHaveBeenCalled();
  });

  it('exige validar el token en una ruta sin @Public() de un controller con otra ruta publica', () => {
    const validar = espiarValidacionDeToken();

    guard.canActivate(contexto(ControllerAbierto, 'cerradaPorDefecto'));

    expect(validar).toHaveBeenCalledTimes(1);
  });

  it('exige validar el token en una ruta sin marca alguna (protegida por defecto)', () => {
    const validar = espiarValidacionDeToken();

    guard.canActivate(contexto(ControllerCerrado, 'sinMarca'));

    expect(validar).toHaveBeenCalledTimes(1);
  });

  it('una ruta protegida sin token (sin usuario) responde 401 problem+json en espanol', () => {
    expect.assertions(3);
    try {
      guard.handleRequest(null, false);
    } catch (error) {
      expect(error).toBeInstanceOf(ProblemException);
      expect((error as ProblemException).getStatus()).toBe(401);
      expect((error as ProblemException).getResponse()).toMatchObject({
        detail: 'El token es inválido, expiró o no fue provisto.',
      });
    }
  });

  it('con un usuario valido handleRequest lo devuelve', () => {
    const usuario = { userId: 1, rol: 'GERENTE' };

    expect(guard.handleRequest(null, usuario)).toBe(usuario);
  });
});
