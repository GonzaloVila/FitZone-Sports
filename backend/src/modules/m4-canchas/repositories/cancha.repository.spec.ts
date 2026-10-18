import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CanchaRepository } from 'src/modules/m4-canchas/repositories/cancha.repository';

function errorPrisma(code: string) {
  return new Prisma.PrismaClientKnownRequestError('error de prueba', { code, clientVersion: 'test' });
}

function repo(update: () => unknown) {
  const prisma = { cancha: { update: vi.fn(async () => update()) } };
  return new CanchaRepository(prisma as never);
}

// El camino de "la cancha no existe" (P2025) no tenia cobertura propia: el service lo
// traduce a 404 y depende de que el repositorio devuelva null en vez de lanzar.
describe('CanchaRepository.actualizar', () => {
  it('devuelve null cuando la cancha no existe (P2025)', async () => {
    const repository = repo(() => {
      throw errorPrisma('P2025');
    });

    await expect(repository.actualizar(99, { estado: 'EN_MANTENIMIENTO' })).resolves.toBeNull();
  });

  it('re-lanza cualquier otro error de Prisma', async () => {
    const repository = repo(() => {
      throw errorPrisma('P1001');
    });

    await expect(repository.actualizar(1, { estado: 'OPERATIVA' })).rejects.toThrow('error de prueba');
  });

  it('re-lanza un error que no es de Prisma', async () => {
    const repository = repo(() => {
      throw new Error('se cayo la conexion');
    });

    await expect(repository.actualizar(1, { estado: 'OPERATIVA' })).rejects.toThrow('se cayo la conexion');
  });
});
