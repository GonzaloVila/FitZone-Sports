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

function fila(id: number, sedeId: number) {
  return { id, sede_id: sedeId, tipo: 'PADDLE', costo_por_hora: { toNumber: () => 5000 }, estado: 'OPERATIVA' };
}

// Prisma simulado para los listados: findMany y count comparten el `where`, que es lo
// que se inspecciona. El orden y la paginacion llegan a findMany tal cual.
function repoDeListado(filas = [fila(1, 1)], total = filas.length) {
  const findMany = vi.fn(async (_args: unknown) => filas);
  const count = vi.fn(async (_args: unknown) => total);
  const repository = new CanchaRepository({ cancha: { findMany, count } } as never);
  return { repository, findMany, count };
}

describe('CanchaRepository.buscar', () => {
  it('sin filtros no restringe nada: where vacio, pagina 1 y orden sede_id, id', async () => {
    const { repository, findMany, count } = repoDeListado();

    await repository.buscar({ page: 1, perPage: 20 });

    expect(findMany).toHaveBeenCalledWith({
      where: {},
      skip: 0,
      take: 20,
      orderBy: [{ sede_id: 'asc' }, { id: 'asc' }],
    });
    expect(count).toHaveBeenCalledWith({ where: {} });
  });

  it('combina sedeId, tipo y estado en el where, y usa el mismo where para contar', async () => {
    const { repository, findMany, count } = repoDeListado();

    await repository.buscar({ sedeId: 3, tipo: 'FUTBOL5', estado: 'EN_MANTENIMIENTO', page: 1, perPage: 20 });

    const where = { sede_id: 3, tipo: 'FUTBOL5', estado: 'EN_MANTENIMIENTO' };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('cada filtro aparece solo si viene: un filtro suelto no arrastra a los otros', async () => {
    const { repository, findMany } = repoDeListado();

    await repository.buscar({ tipo: 'PADDLE', page: 1, perPage: 20 });
    await repository.buscar({ estado: 'OPERATIVA', page: 1, perPage: 20 });
    await repository.buscar({ sedeId: 2, page: 1, perPage: 20 });

    expect(findMany.mock.calls.map(([args]) => (args as { where: unknown }).where)).toEqual([
      { tipo: 'PADDLE' },
      { estado: 'OPERATIVA' },
      { sede_id: 2 },
    ]);
  });

  it('traduce page y perPage a skip y take', async () => {
    const { repository, findMany } = repoDeListado();

    await repository.buscar({ page: 3, perPage: 5 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }));
  });

  it('devuelve el dominio con costoPorHora numerico y el total del count', async () => {
    const { repository } = repoDeListado([fila(7, 2), fila(8, 2)], 42);

    const res = await repository.buscar({ page: 1, perPage: 2 });

    expect(res.total).toBe(42);
    expect(res.items).toEqual([
      { id: 7, sedeId: 2, tipo: 'PADDLE', costoPorHora: 5000, estado: 'OPERATIVA' },
      { id: 8, sedeId: 2, tipo: 'PADDLE', costoPorHora: 5000, estado: 'OPERATIVA' },
    ]);
  });
});

// Se generalizo el listado compartiendo `paginar` con buscar: el de por sede tiene que
// seguir filtrando por su sede y por estado, y nada mas.
describe('CanchaRepository.listarPorSede', () => {
  it('filtra siempre por la sede y suma el estado solo si viene', async () => {
    const { repository, findMany, count } = repoDeListado();

    await repository.listarPorSede(4, { page: 1, perPage: 20 });
    await repository.listarPorSede(4, { estado: 'EN_MANTENIMIENTO', page: 2, perPage: 10 });

    expect(findMany).toHaveBeenNthCalledWith(1, {
      where: { sede_id: 4 },
      skip: 0,
      take: 20,
      orderBy: [{ sede_id: 'asc' }, { id: 'asc' }],
    });
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { sede_id: 4, estado: 'EN_MANTENIMIENTO' }, skip: 10, take: 10 }),
    );
    expect(count).toHaveBeenNthCalledWith(2, { where: { sede_id: 4, estado: 'EN_MANTENIMIENTO' } });
  });
});

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
