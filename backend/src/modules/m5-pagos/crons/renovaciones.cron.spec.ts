import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MembresiaRenovable } from '../../m1-usuarios/entities/membresia.entity';
import type { MembresiaPrecioService } from '../../m1-usuarios/services/membresia-precio.service';
import type { MembresiasService } from '../../m1-usuarios/services/membresias.service';
import type { RenovacionesService } from '../services/renovaciones.service';
import { RenovacionesCron } from './renovaciones.cron';

// RF-02: renovacion automatica nocturna. Primero se cobra (M5) y solo si el cobro se aprueba se extiende el periodo
// (M1). Un cobro rechazado deja la membresia vencida y no corta el resto del lote.
function renovable(id: number, plan: MembresiaRenovable['plan'], fechaFin: string): MembresiaRenovable {
  return { id, usuarioId: 100 + id, plan, precio: 30_000 * id, fechaFin: new Date(fechaFin) };
}

function armar(lista: MembresiaRenovable[]) {
  const membresias = {
    listarRenovables: vi.fn().mockResolvedValue(lista),
    renovar: vi.fn().mockResolvedValue({}),
  };
  const renovaciones = { cobrarMembresia: vi.fn().mockResolvedValue({ id: 1, estado: 'APROBADO' }) };
  const cron = new RenovacionesCron(
    membresias as unknown as MembresiasService,
    {} as MembresiaPrecioService,
    renovaciones as unknown as RenovacionesService,
  );
  return { cron, membresias, renovaciones };
}

describe('RenovacionesCron (RF-02)', () => {
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('busca las renovables a la fecha de la corrida', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T03:00:00Z'));
    const { cron, membresias } = armar([]);

    await cron.renovar();

    expect(membresias.listarRenovables).toHaveBeenCalledWith(new Date('2026-11-09T03:00:00Z'));
  });

  it('cobra cada membresia con su usuario y su precio, y una idempotency key estable por periodo', async () => {
    const m = renovable(1, 'MENSUAL', '2026-11-08T12:00:00Z');
    const { cron, renovaciones } = armar([m]);

    await cron.renovar();

    expect(renovaciones.cobrarMembresia).toHaveBeenCalledWith(
      { membresiaId: 1, usuarioId: 101, precio: 30_000 },
      `renov-1-${m.fechaFin.getTime()}`,
    );
  });

  it('con el cobro aprobado renueva el periodo contiguo, anclado en la fecha_fin previa', async () => {
    const { cron, membresias } = armar([
      renovable(1, 'MENSUAL', '2026-11-08T12:00:00Z'),
      renovable(2, 'TRIMESTRAL', '2026-11-08T12:00:00Z'),
      renovable(3, 'ANUAL', '2026-11-08T12:00:00Z'),
    ]);

    await cron.renovar();

    const fin = (id: number) =>
      (membresias.renovar.mock.calls.find(([mid]) => mid === id)![1] as { fechaInicio: Date; fechaFin: Date });
    expect(fin(1)).toEqual({ fechaInicio: new Date('2026-11-08T12:00:00Z'), fechaFin: new Date('2026-12-08T12:00:00Z') });
    expect(fin(2).fechaFin).toEqual(new Date('2027-02-08T12:00:00Z'));
    expect(fin(3).fechaFin).toEqual(new Date('2027-11-08T12:00:00Z'));
  });

  it('un cobro rechazado no renueva esa membresia y no corta el resto del lote', async () => {
    const { cron, membresias, renovaciones } = armar([
      renovable(1, 'MENSUAL', '2026-11-08T12:00:00Z'),
      renovable(2, 'MENSUAL', '2026-11-08T12:00:00Z'),
      renovable(3, 'MENSUAL', '2026-11-08T12:00:00Z'),
    ]);
    renovaciones.cobrarMembresia.mockImplementation(async ({ membresiaId }: { membresiaId: number }) => {
      if (membresiaId === 2) throw new Error('pago rechazado');
      return { estado: 'APROBADO' };
    });

    await cron.renovar();

    expect(renovaciones.cobrarMembresia).toHaveBeenCalledTimes(3);
    expect(membresias.renovar.mock.calls.map(([id]) => id)).toEqual([1, 3]);
    expect(log).toHaveBeenCalledWith('Renovación automática: 2 renovadas, 1 rechazadas.');
  });

  it('si falla la renovacion en M1 despues del cobro, cuenta como rechazada y sigue', async () => {
    const { cron, membresias } = armar([
      renovable(1, 'MENSUAL', '2026-11-08T12:00:00Z'),
      renovable(2, 'MENSUAL', '2026-11-08T12:00:00Z'),
    ]);
    membresias.renovar.mockRejectedValueOnce(new Error('no encontrada')).mockResolvedValueOnce({});

    await cron.renovar();

    expect(membresias.renovar).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith('Renovación automática: 1 renovadas, 1 rechazadas.');
  });

  it('sin renovables no cobra ni deja log', async () => {
    const { cron, renovaciones } = armar([]);

    await cron.renovar();

    expect(renovaciones.cobrarMembresia).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
