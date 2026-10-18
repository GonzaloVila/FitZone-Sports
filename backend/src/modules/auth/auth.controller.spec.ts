import { HttpException, HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AuthController } from 'src/modules/auth/auth.controller';
import type { AuthService } from 'src/modules/auth/auth.service';
import { sesionInvalida } from 'src/modules/auth/errors/auth.errors';
import type { TotpService } from 'src/modules/auth/services/totp.service';

const ORIGEN = 'http://localhost:5173';

const config = {
  get: (clave: string) =>
    ({
      CORS_ORIGINS: [ORIGEN],
      REFRESH_EXPIRES_IN: 604800,
      REFRESH_COOKIE_SAMESITE: 'lax',
      REFRESH_COOKIE_SECURE: false,
    })[clave],
} as unknown as ConfigService;

function armar(refrescar: () => Promise<unknown>) {
  const authService = { refrescar } as unknown as AuthService;
  const controller = new AuthController(authService, {} as TotpService, config);
  const cookie = vi.fn();
  const res = { cookie } as unknown as Response;
  const req = { headers: { cookie: 'refresh_token=abc', origin: ORIGEN } } as unknown as Request;
  return { controller, res, req, cookie };
}

describe('AuthController.refrescar: borrado de la cookie ante un error', () => {
  it('borra la cookie (Max-Age 0) cuando el error es el 401 de sesion invalida', async () => {
    const { controller, res, req, cookie } = armar(async () => {
      throw sesionInvalida();
    });

    await expect(controller.refrescar({}, req, res)).rejects.toMatchObject({ status: 401 });

    expect(cookie).toHaveBeenCalledTimes(1);
    expect(cookie).toHaveBeenCalledWith(
      'refresh_token',
      '',
      expect.objectContaining({ maxAge: 0, httpOnly: true, path: '/api/v1/auth' }),
    );
  });

  it('deja la cookie como esta y relanza el mismo error ante un 5xx', async () => {
    const error = new HttpException('la base no responde', HttpStatus.INTERNAL_SERVER_ERROR);
    const { controller, res, req, cookie } = armar(async () => {
      throw error;
    });

    await expect(controller.refrescar({}, req, res)).rejects.toBe(error);
    expect(cookie).not.toHaveBeenCalled();
  });

  it('deja la cookie como esta ante un error que no es de dominio', async () => {
    const error = new Error('timeout de conexion');
    const { controller, res, req, cookie } = armar(async () => {
      throw error;
    });

    await expect(controller.refrescar({}, req, res)).rejects.toBe(error);
    expect(cookie).not.toHaveBeenCalled();
  });
});
