import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PagoRepository } from 'src/modules/m5-pagos/repositories/pago.repository';
import type { PagoNuevo } from 'src/modules/m5-pagos/entities/pago.entity';

// Fijan la traducción de la violación de `@unique` a motivo de dominio, que es la
// garantía de idempotencia de la decisión 6 del plan. La prueba clave es la
// SEGUNDA: que los dos `@unique` posibles no se colapsen en un motivo, porque
// significan cosas distintas (reintento del cliente vs. reserva cobrada dos veces).
describe('PagoRepository', () => {
  function p2002(target: string | string[]) {
    return new Prisma.PrismaClientKnownRequestError('violación de unique', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target },
    });
  }

  function fila(over: Record<string, unknown> = {}) {
    return {
      id: 8,
      usuario_id: 1,
      idempotencia_key: 'clave-1',
      fecha_pago: new Date('2026-09-16T18:42:11.204Z'),
      monto: new Prisma.Decimal('4250'),
      moneda: 'ARS',
      estado: 'PENDIENTE',
      token: 'tok_aprobado_1',
      comprobante_pdf_url: null,
      pago_reserva: { id_pago: 8, reserva_id: 7 },
      pago_membresia: null,
      ...over,
    };
  }

  function repo(create: () => unknown) {
    const create_ = vi.fn(async (_args: { data: Record<string, unknown> }) => create());
    const prisma = { pago: { create: create_ } };
    return {
      prisma,
      repository: new PagoRepository(prisma as never),
    };
  }

  const nuevo: PagoNuevo = {
    usuarioId: 1,
    concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: 7 },
    monto: 4250,
    moneda: 'ARS',
    token: 'tok_aprobado_1',
    idempotenciaKey: 'clave-1',
  };

  describe('crear', () => {
    it('escribe el pago PENDIENTE con el subtipo del concepto, en una sola sentencia', async () => {
      const { prisma, repository } = repo(() => fila());

      const resultado = await repository.crear(nuevo);

      expect(resultado.ok).toBe(true);
      const data = prisma.pago.create.mock.calls[0]![0].data;
      // El subtipo anidado es lo que materializa la herencia parte-todo: sin esto
      // el pago existiría sin concepto y el listado no lo sabría traducir.
      expect(data.pago_reserva).toEqual({ create: { reserva_id: 7 } });
      expect(data.pago_membresia).toBeUndefined();
      // Explícito, nunca por defecto (decisión 7).
      expect(data.estado).toBe('PENDIENTE');
      expect(data.usuario_id).toBe(1);
    });

    it('crea el subtipo de membresía cuando el concepto es MEMBRESIA', async () => {
      const { prisma, repository } = repo(() =>
        fila({ pago_reserva: null, pago_membresia: { id_pago: 8, membresia_id: 3 } }),
      );

      const resultado = await repository.crear({
        ...nuevo,
        concepto: { tipo: 'MEMBRESIA', membresiaId: 3 },
      });

      expect(resultado.ok).toBe(true);
      const data = prisma.pago.create.mock.calls[0]![0].data;
      expect(data.pago_membresia).toEqual({ create: { membresia_id: 3 } });
      expect(data.pago_reserva).toBeUndefined();
    });

    it('traduce la violación de idempotencia_key a IDEMPOTENCIA_REPETIDA', async () => {
      const { repository } = repo(() => {
        throw p2002('Pago_idempotencia_key_key');
      });

      const resultado = await repository.crear(nuevo);

      expect(resultado).toEqual({ ok: false, motivo: 'IDEMPOTENCIA_REPETIDA' });
    });

    it('traduce la violación de reserva_id a RESERVA_YA_COBRADA, no a idempotencia', async () => {
      const { repository } = repo(() => {
        throw p2002(['reserva_id']);
      });

      const resultado = await repository.crear(nuevo);

      expect(resultado).toEqual({ ok: false, motivo: 'RESERVA_YA_COBRADA' });
    });

    it('re-lanza cualquier otro error: un P2002 ajeno no se come', async () => {
      const { repository } = repo(() => {
        throw new Prisma.PrismaClientKnownRequestError('no se puede conectar', {
          code: 'P1001',
          clientVersion: 'test',
        });
      });

      await expect(repository.crear(nuevo)).rejects.toThrow('no se puede conectar');
    });

    it('re-lanza un P2002 cuyo target no se reconoce, por default a idempotencia', async () => {
      const { repository } = repo(() => {
        throw p2002('algun_unique_futuro_key');
      });

      const resultado = await repository.crear(nuevo);

      // El default es el motivo que el contrato YA declara para este endpoint: si
      // mañana aparece otro `@unique`, sale un 409 conocido en vez de un motivo
      // que nadie sabe traducir.
      expect(resultado).toEqual({ ok: false, motivo: 'IDEMPOTENCIA_REPETIDA' });
    });
  });

  describe('buscarPorId', () => {
    it('devuelve null si no existe', async () => {
      const prisma = { pago: { findUnique: vi.fn(async (_args: unknown) => null) } };
      const repository = new PagoRepository(prisma as never);

      await expect(repository.buscarPorId(999)).resolves.toBeNull();
    });

    it('traduce el subtipo al ConceptoPago del dominio', async () => {
      const prisma = { pago: { findUnique: vi.fn(async (_args: unknown) => fila()) } };
      const repository = new PagoRepository(prisma as never);

      const pago = await repository.buscarPorId(8);

      expect(pago?.concepto).toEqual({ tipo: 'RESERVA_CANCHA', reservaCanchaId: 7 });
      // El Decimal de Prisma sale como number: `PagoOut.monto` es number y un
      // Decimal filtrado a la respuesta se serializa raro.
      expect(pago?.monto).toBe(4250);
      expect(typeof pago?.monto).toBe('number');
    });
  });

  describe('anular', () => {
    function anulable(estado: string) {
      return {
        pago: {
          update: vi.fn(async (_args: { where: unknown; data: unknown }) => fila({ estado })),
        },
      };
    }

    it('filtra por estado en el propio UPDATE, no en un find previo', async () => {
      const prisma = anulable('ANULADO');
      const repository = new PagoRepository(prisma as never);

      await repository.anular({ id: 8, token: 'tok', monto: 4250, moneda: 'ARS' });

      // Dos anulaciones simultáneas no pueden ganar las dos: la segunda recibe
      // P2025 y sale null.
      const where = prisma.pago.update.mock.calls[0]![0].where;
      expect(where).toEqual({ id: 8, estado: { in: ['PENDIENTE', 'APROBADO'] } });
    });

    it('devuelve null cuando el pago no está en un estado anulable (P2025)', async () => {
      const prisma = {
        pago: {
          update: vi.fn(async () => {
            throw new Prisma.PrismaClientKnownRequestError('no encontrado', {
              code: 'P2025',
              clientVersion: 'test',
            });
          }),
        },
      };
      const repository = new PagoRepository(prisma as never);

      await expect(
        repository.anular({ id: 8, token: 'tok', monto: 1, moneda: 'ARS' }),
      ).resolves.toBeNull();
    });
  });

  describe('listar', () => {
    function listado() {
      // Tipar el arg con Prisma.PagoFindManyArgs hace que mock.calls[0]![0] sea el
      // tipo real y no `unknown`, asi el spec puede asertar sobre .where sin casts.
      const findMany = vi.fn(async (_args: Prisma.PagoFindManyArgs) => [fila()]);
      const prisma = { pago: { findMany } };
      return { prisma, repository: new PagoRepository(prisma as never) };
    }

    it('traduce el discriminante `tipo` al subtipo, en las tres direcciones', async () => {
      const { prisma, repository } = listado();

      await repository.listar({ tipo: 'RESERVA_CANCHA' }, { page: 1, perPage: 20 });
      await repository.listar({ tipo: 'MEMBRESIA' }, { page: 1, perPage: 20 });
      await repository.listar({ tipo: 'RESERVA_CLASE' }, { page: 1, perPage: 20 });

      // El `is` sobre los subtipos contrarios es lo que hace que el filtro sirva: preguntar
      // solo por `pago_reserva: { isNot: null }` traería también los pagos de membresía,
      // que es justo el error que el filtro existe para evitar.
      expect(prisma.pago.findMany.mock.calls[0]![0].where!.AND).toEqual({
        pago_reserva: { isNot: null },
        pago_membresia: { is: null },
        pago_reserva_clase: { is: null },
      });
      expect(prisma.pago.findMany.mock.calls[1]![0].where!.AND).toEqual({
        pago_membresia: { isNot: null },
        pago_reserva: { is: null },
        pago_reserva_clase: { is: null },
      });
      expect(prisma.pago.findMany.mock.calls[2]![0].where!.AND).toEqual({
        pago_reserva_clase: { isNot: null },
        pago_reserva: { is: null },
        pago_membresia: { is: null },
      });
    });

    it('filtra los ids de concepto por relación, no por una columna de Pago', async () => {
      const { prisma, repository } = listado();

      await repository.listar(
        { reservaCanchaId: 7, membresiaId: 3 },
        { page: 1, perPage: 20 },
      );

      const where = prisma.pago.findMany.mock.calls[0]![0].where!;
      // El id del concepto vive en la tabla del subtipo: es la herencia parte-todo.
      expect(where.pago_reserva).toEqual({ reserva_id: 7 });
      expect(where.pago_membresia).toEqual({ membresia_id: 3 });
    });

    it('acota el rango de fechas solo si viene alguna de las dos puntas', async () => {
      const { prisma, repository } = listado();
      const desde = new Date('2026-03-01T03:00:00.000Z');
      const hasta = new Date('2026-04-01T03:00:00.000Z');

      await repository.listar({}, { page: 1, perPage: 20 });
      expect(prisma.pago.findMany.mock.calls[0]![0].where!.fecha_pago).toBeUndefined();

      await repository.listar({ desde, hasta }, { page: 1, perPage: 20 });
      expect(prisma.pago.findMany.mock.calls[1]![0].where!.fecha_pago).toEqual({
        gte: desde,
        lt: hasta,
      });
    });

    // Sin el desempate por id, dos pagos del mismo lote (mismo `fecha_pago`) pueden caer
    // en páginas distintas según el plan de ejecución: el listado repite filas y la
    // paginación deja de ser consistente.
    it('ordena por fecha_pago y desempata por id', async () => {
      const { prisma, repository } = listado();

      await repository.listar({}, { page: 1, perPage: 20 });

      expect(prisma.pago.findMany.mock.calls[0]![0].orderBy).toEqual([
        { fecha_pago: 'desc' },
        { id: 'desc' },
      ]);
    });

    it('pagina con skip/take', async () => {
      const { prisma, repository } = listado();

      await repository.listar({}, { page: 3, perPage: 5 });

      const args = prisma.pago.findMany.mock.calls[0]![0];
      expect(args.skip).toBe(10);
      expect(args.take).toBe(5);
    });

    it('traduce cada fila a ConceptoPago, sin inventar el que falta', async () => {
      const { repository } = listado();

      const pagos = await repository.listar({}, { page: 1, perPage: 20 });

      expect(pagos[0]?.concepto).toEqual({ tipo: 'RESERVA_CANCHA', reservaCanchaId: 7 });
    });
  });

  it('se niega a inventar un concepto si la fila no tiene subtipo', async () => {
    const prisma = {
      pago: {
        findUnique: vi.fn(async (_args: unknown) =>
          fila({ pago_reserva: null, pago_membresia: null }),
        ),
      },
    };
    const repository = new PagoRepository(prisma as never);

    await expect(repository.buscarPorId(8)).rejects.toThrow(/no tiene subtipo/);
  });
});