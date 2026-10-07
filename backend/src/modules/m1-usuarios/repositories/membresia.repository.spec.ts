import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../../commons/database/prisma.service';
import { PrismaMembresiaRepository } from './membresia.repository';

// Las dos cosas que se rompen en silencio en obtenerParaCobro: que el precio salga
// como `number` y no como el `Decimal` de Prisma (el `Pago.monto` es Decimal y un
// number[float] manda ruido ahi), y que cruce a Socio por `usuario_id` (la membresia
// no lo tiene). Son la mecanica que antes fijaba el spec del service de precio.
describe('PrismaMembresiaRepository', () => {
  function repo(resultadoFind: unknown, errorUpdate?: unknown) {
    const prisma = {
      membresia: {
        findUnique: async () => resultadoFind,
        update: async () => {
          throw errorUpdate;
        },
      },
    } as unknown as PrismaService;
    return new PrismaMembresiaRepository(prisma);
  }

  it('obtenerParaCobro devuelve el tipo de dominio con precio number y usuario del socio', async () => {
    const resultado = await repo({
      id: 7,
      plan: 'TRIMESTRAL',
      estado: 'ACTIVA',
      precio: new Prisma.Decimal('80000'),
      socio: { usuario_id: 42 },
    }).obtenerParaCobro(7);

    expect(resultado).toEqual({
      membresia_id: 7,
      usuario_id: 42,
      plan: 'TRIMESTRAL',
      precio: 80000,
      estado: 'ACTIVA',
    });
    expect(typeof resultado!.precio).toBe('number');
  });

  it('obtenerParaCobro devuelve null cuando la membresia no existe', async () => {
    await expect(repo(null).obtenerParaCobro(999)).resolves.toBeNull();
  });

  it('renovar devuelve null cuando Prisma no encuentra la fila (P2025)', async () => {
    const noEncontrado = new Prisma.PrismaClientKnownRequestError('no existe', {
      code: 'P2025',
      clientVersion: 'test',
    });
    await expect(
      repo(null, noEncontrado).renovar(999, {
        fecha_inicio: new Date('2026-10-01T00:00:00.000Z'),
        fecha_fin: new Date('2026-11-01T00:00:00.000Z'),
      }),
    ).resolves.toBeNull();
  });

  it('renovar propaga cualquier otro error', async () => {
    const otro = new Error('conexion caida');
    await expect(
      repo(null, otro).renovar(1, {
        fecha_inicio: new Date('2026-10-01T00:00:00.000Z'),
        fecha_fin: new Date('2026-11-01T00:00:00.000Z'),
      }),
    ).rejects.toBe(otro);
  });
});
