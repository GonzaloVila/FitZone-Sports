import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MembresiaRepository } from '../domain/membresia.port';
import { MembresiasCron } from './membresias.cron';

// Job nocturno que pasa a VENCIDA las membresias ACTIVA cuya fecha_fin ya paso (sin el, el estado no se moveria solo).
describe('MembresiasCron', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function armar(cantidad: number) {
    const repo = { marcarVencidas: vi.fn().mockResolvedValue(cantidad) };
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    return { cron: new MembresiasCron(repo as unknown as MembresiaRepository), repo, log };
  }

  it('marca las vencidas y deja constancia de cuantas fueron', async () => {
    const { cron, repo, log } = armar(4);

    await cron.marcarVencidas();

    expect(repo.marcarVencidas).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Membresías marcadas como VENCIDA: 4');
  });

  it('si no vencio ninguna no ensucia el log', async () => {
    const { cron, log } = armar(0);

    await cron.marcarVencidas();

    expect(log).not.toHaveBeenCalled();
  });
});
