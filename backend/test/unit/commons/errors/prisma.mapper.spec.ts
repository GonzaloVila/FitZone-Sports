import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { mapearErrorPrisma } from 'src/commons/errors/prisma.mapper';

const CLIENT_VERSION = 'test';

function conocido(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('error de prueba', {
    code,
    clientVersion: CLIENT_VERSION,
  });
}

describe('mapearErrorPrisma', () => {
  it('P2002 es UNIQUE', () => {
    expect(mapearErrorPrisma(conocido('P2002'))).toBe('UNIQUE');
  });

  it('P2025 es NO_ENCONTRADO', () => {
    expect(mapearErrorPrisma(conocido('P2025'))).toBe('NO_ENCONTRADO');
  });

  it('P2003 es FK', () => {
    expect(mapearErrorPrisma(conocido('P2003'))).toBe('FK');
  });

  it('la violacion de la constraint de exclusion (error desconocido con el nombre en el mensaje) es EXCLUSION', () => {
    const error = new Prisma.PrismaClientUnknownRequestError(
      'conflicting key value violates exclusion constraint "exq_reserva_turno" (23P01)',
      { clientVersion: CLIENT_VERSION },
    );
    expect(mapearErrorPrisma(error)).toBe('EXCLUSION');
  });

  it('un error desconocido que no nombra una constraint registrada es null', () => {
    const error = new Prisma.PrismaClientUnknownRequestError('otra cosa', {
      clientVersion: CLIENT_VERSION,
    });
    expect(mapearErrorPrisma(error)).toBeNull();
  });

  it('un codigo de Prisma sin mapeo es null', () => {
    expect(mapearErrorPrisma(conocido('P2034'))).toBeNull();
  });

  it('un error que no es de Prisma es null', () => {
    expect(mapearErrorPrisma(new Error('exq_reserva_turno'))).toBeNull();
    expect(mapearErrorPrisma('texto')).toBeNull();
    expect(mapearErrorPrisma(undefined)).toBeNull();
  });
});
