import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PagoRepository } from 'src/modules/m5-pagos/repositories/pago.repository';

// Read side del reporte de ingresos: la sede se resuelve por concepto con includes anidados.
describe('PagoRepository.listarAprobadosConSede', () => {
  const base = { monto: new Prisma.Decimal('7750'), fecha_pago: new Date('2026-10-08T15:00:00.000Z') };
  const sede = { id: 3, nombre: 'Sede Centro', direccion: 'x', aforo_maximo: 10 };
  const sinSubtipos = { pago_reserva: null, pago_membresia: null, pago_reserva_clase: null };

  function repo(filas: unknown[]) {
    const findMany = vi.fn().mockResolvedValue(filas);
    return { findMany, repository: new PagoRepository({ pago: { findMany } } as never) };
  }

  it('filtra APROBADO y el rango [desde, hasta)', async () => {
    const { findMany, repository } = repo([]);
    const desde = new Date('2026-10-08T03:00:00.000Z');
    const hasta = new Date('2026-10-09T03:00:00.000Z');

    await repository.listarAprobadosConSede({ desde, hasta });

    expect(findMany.mock.calls[0][0].where).toEqual({
      estado: 'APROBADO',
      fecha_pago: { gte: desde, lt: hasta },
    });
  });

  it('sin rango no filtra por fecha', async () => {
    const { findMany, repository } = repo([]);

    await repository.listarAprobadosConSede({});

    expect(findMany.mock.calls[0][0].where).toEqual({ estado: 'APROBADO' });
  });

  it('resuelve la sede de cada concepto y marca huérfano con sede null', async () => {
    const { repository } = repo([
      { ...base, ...sinSubtipos, pago_reserva: { reserva: { cancha: { sede } } } },
      { ...base, ...sinSubtipos, pago_membresia: { membresia: { socio: { sede } } } },
      { ...base, ...sinSubtipos, pago_reserva_clase: { reserva_clase: { clase: { sede } } } },
      { ...base, ...sinSubtipos, pago_membresia: { membresia: null } },
      { ...base, ...sinSubtipos },
    ]);

    const resultado = await repository.listarAprobadosConSede({});

    expect(resultado.map((r) => [r.tipo, r.sede])).toEqual([
      ['RESERVA_CANCHA', { id: 3, nombre: 'Sede Centro' }],
      ['MEMBRESIA', { id: 3, nombre: 'Sede Centro' }],
      ['RESERVA_CLASE', { id: 3, nombre: 'Sede Centro' }],
      ['MEMBRESIA', null],
    ]);
    expect(resultado[0].monto).toBe(7750);
  });
});
