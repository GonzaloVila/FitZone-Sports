import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GENERIC_TYPE, ProblemException, recursoNoEncontrado } from './problem.exception';
import { ProblemFilter } from './problem.filter';

// ProblemFilter es el filtro global: toda excepcion termina como application/problem+json (RFC 9457). Se prueba sin
// levantar Nest, con un host falso que captura lo que el filtro escribe en la respuesta.
const URL_PEDIDA = '/api/v1/recurso/42';

function capturar(exception: unknown) {
  const response = { status: vi.fn(), setHeader: vi.fn(), end: vi.fn() };
  const request = { method: 'POST', originalUrl: URL_PEDIDA, url: URL_PEDIDA };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost;

  new ProblemFilter().catch(exception, host);

  const body = JSON.parse(response.end.mock.calls[0][0] as string) as Record<string, unknown>;
  return { body, status: response.status.mock.calls[0][0] as number, headers: response.setHeader.mock.calls };
}

function prismaConocido(code: string, target?: string | string[]) {
  return new Prisma.PrismaClientKnownRequestError('error de prueba', {
    code,
    clientVersion: 'test',
    meta: target === undefined ? undefined : { target },
  });
}

describe('ProblemFilter', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // El filtro loguea a proposito (warn de dominio sin migrar, error de los 500); se silencia para no ensuciar la salida.
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('respuesta', () => {
    it('escribe el status y el content-type application/problem+json', () => {
      const { status, headers } = capturar(recursoNoEncontrado('No existe la cancha.'));

      expect(status).toBe(404);
      expect(headers).toContainEqual(['Content-Type', 'application/problem+json']);
    });
  });

  describe('errores de dominio (ProblemException)', () => {
    it('respeta el cuerpo de dominio y completa instance con la URL pedida', () => {
      const { body } = capturar(recursoNoEncontrado('No existe la cancha.'));

      expect(body).toEqual({
        type: GENERIC_TYPE,
        title: 'Recurso no encontrado',
        status: 404,
        detail: 'No existe la cancha.',
        instance: URL_PEDIDA,
      });
    });

    it('no pisa un instance que el dominio ya haya puesto, ni sus campos extra', () => {
      const { body } = capturar(
        new ProblemException({
          type: 'https://fitzone.app/errores/aforo-completo',
          title: 'Aforo completo',
          status: 409,
          instance: '/otra',
          aforoMaximo: 50,
        }),
      );

      expect(body).toMatchObject({ instance: '/otra', aforoMaximo: 50, status: 409 });
    });
  });

  describe('validacion (422)', () => {
    it('convierte el 400 de ValidationPipe en 422 con la lista de errores', () => {
      const errores = ['nombre should not be empty', 'aforoMaximo must be a positive number'];
      const { status, body } = capturar(new BadRequestException(errores));

      expect(status).toBe(422);
      expect(body).toEqual({
        type: GENERIC_TYPE,
        title: 'Error de validación',
        status: 422,
        detail: 'Uno o más campos no cumplen las reglas de validación.',
        instance: URL_PEDIDA,
        errors: errores,
      });
    });

    it('convierte el 400 de ParseIntPipe en el mismo 422, sin filtrar el mensaje en ingles', () => {
      const { status, body } = capturar(new BadRequestException('Validation failed (numeric string is expected)'));

      expect(status).toBe(422);
      expect(body).toMatchObject({ detail: 'Uno o más campos no cumplen las reglas de validación.', errors: [] });
      expect(JSON.stringify(body)).not.toContain('Validation failed');
    });
  });

  describe('errores del framework', () => {
    it('reemplaza el 404 de ruta inexistente por un detalle fijo en espanol', () => {
      const { status, body } = capturar(new NotFoundException('Cannot GET /api/v1/nada'));

      expect(status).toBe(404);
      expect(body.detail).toBe('La ruta solicitada no existe o el recurso no fue encontrado.');
    });

    it.each(['Unexpected token } in JSON at position 10', 'Expected property name or } in JSON at position 1', 'Unexpected end of JSON input'])(
      'reemplaza el 400 de JSON invalido (%s)',
      (mensaje) => {
        const { status, body } = capturar(new BadRequestException(mensaje));

        expect(status).toBe(400);
        expect(body).toMatchObject({ title: 'Solicitud incorrecta', detail: expect.stringContaining('no es JSON válido') });
      },
    );

    it('un 4xx del framework sin detalle propio usa el generico', () => {
      const { body } = capturar(new HttpException('Cannot DELETE /x', HttpStatus.METHOD_NOT_ALLOWED));

      expect(body).toMatchObject({ status: 405, title: 'Error de la solicitud', detail: 'La solicitud no pudo procesarse.' });
    });
  });

  describe('HttpException de dominio sin migrar', () => {
    it('preserva el mensaje en espanol y avisa en el log', () => {
      const { status, body } = capturar(new ConflictException('La clase ya empezó.'));

      expect(status).toBe(409);
      expect(body).toMatchObject({ title: 'Conflicto', detail: 'La clase ya empezó.' });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('sin migrar a ProblemException'));
    });

    it('un 5xx conserva su mensaje y su titulo', () => {
      const { body } = capturar(new ServiceUnavailableException('La pasarela no responde.'));

      expect(body).toMatchObject({ status: 503, title: 'Servicio no disponible', detail: 'La pasarela no responde.' });
    });
  });

  describe('errores de Prisma que se escapan del repositorio', () => {
    it('P2002 sobre la idempotencia_key responde 409 idempotencia-repetida', () => {
      const { status, body } = capturar(prismaConocido('P2002', ['idempotencia_key']));

      expect(status).toBe(409);
      expect(body).toMatchObject({
        type: 'https://fitzone.app/errores/idempotencia-repetida',
        detail: 'Ya existe un pago con esa Idempotency-Key.',
      });
    });

    it('P2002 sobre la idempotencia_key tambien se reconoce si el target viene como string', () => {
      const { body } = capturar(prismaConocido('P2002', 'Pago_idempotencia_key_key'));
      expect(body.type).toBe('https://fitzone.app/errores/idempotencia-repetida');
    });

    it('cualquier otro P2002 responde 409 de unicidad generico', () => {
      const { status, body } = capturar(prismaConocido('P2002', ['email']));

      expect(status).toBe(409);
      expect(body).toMatchObject({ type: GENERIC_TYPE, title: 'Conflicto de unicidad' });
    });

    it('P2002 sin meta.target tambien es 409 generico', () => {
      expect(capturar(prismaConocido('P2002')).body.title).toBe('Conflicto de unicidad');
    });

    it('P2025 responde 404', () => {
      expect(capturar(prismaConocido('P2025')).body).toMatchObject({ status: 404, title: 'Recurso no encontrado' });
    });

    it('P2003 responde 422 de referencia inexistente', () => {
      expect(capturar(prismaConocido('P2003')).body).toMatchObject({ status: 422, title: 'Referencia inexistente' });
    });

    it('un codigo de Prisma sin traduccion termina en 500', () => {
      expect(capturar(prismaConocido('P2034')).status).toBe(500);
    });

    it('la violacion de la constraint de exclusion de canchas se traduce a 409 turno-ocupado (RN-02)', () => {
      const error = new Prisma.PrismaClientUnknownRequestError(
        'conflicting key value violates exclusion constraint "exq_reserva_turno"',
        { clientVersion: 'test' },
      );
      const { status, body } = capturar(error);

      expect(status).toBe(409);
      expect(body).toMatchObject({ type: 'https://fitzone.app/errores/turno-ocupado', instance: URL_PEDIDA });
    });
  });

  describe('errores inesperados (500)', () => {
    it('fuera de produccion muestra el mensaje para depurar', () => {
      vi.stubEnv('NODE_ENV', 'test');
      const { status, body } = capturar(new Error('se rompió algo adentro'));

      expect(status).toBe(500);
      expect(body).toMatchObject({ title: 'Error interno del servidor', detail: 'se rompió algo adentro' });
    });

    it('en produccion oculta el mensaje interno', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { body } = capturar(new Error('password=1234 en la query'));

      expect(body.detail).toBe('Ocurrió un error inesperado en el servidor.');
      expect(JSON.stringify(body)).not.toContain('password');
    });

    it('acepta algo que ni siquiera es un Error', () => {
      vi.stubEnv('NODE_ENV', 'test');
      expect(capturar('texto suelto').body).toMatchObject({ status: 500, detail: 'texto suelto' });
    });
  });
});
