import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EsperaClaseRepository } from '../repositories/espera-clase.repository';
import type { CupoLiberadoEvent } from './cupo-liberado.event';
import { NotificarSociosEsperaObserver } from './notificar-socios-espera.observer';

// RF-08, patron Observer: al liberarse un cupo, toda la cola EN_ESPERA de la clase pasa a NOTIFICADO (first-come).
const EVENTO: CupoLiberadoEvent = {
  claseId: 30,
  nombreClase: 'Spinning',
  horarioClase: '2026-11-10T21:00:00.000Z',
  socioIdCancelador: 7,
  fechaLiberacion: new Date('2026-11-09T15:00:00Z'),
};

describe('NotificarSociosEsperaObserver (RF-08)', () => {
  let log: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function armar(enEspera: number) {
    const repo = {
      buscarEnEsperaPorClase: vi.fn().mockResolvedValue(Array.from({ length: enEspera }, (_, i) => ({ id: i + 1 }))),
      marcarNotificados: vi.fn().mockResolvedValue(enEspera),
    };
    return { observer: new NotificarSociosEsperaObserver(repo as unknown as EsperaClaseRepository), repo };
  }

  it('pasa a NOTIFICADO a toda la cola de la clase con la fecha del aviso', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T15:00:05Z'));
    const { observer, repo } = armar(3);

    await observer.notificarCupoDisponible(EVENTO);

    expect(repo.buscarEnEsperaPorClase).toHaveBeenCalledWith(30);
    expect(repo.marcarNotificados).toHaveBeenCalledWith(30, new Date('2026-11-09T15:00:05Z'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Notificados 3 socios en espera para la clase 30'));
  });

  it('sin nadie en espera no actualiza nada', async () => {
    const { observer, repo } = armar(0);

    await observer.notificarCupoDisponible(EVENTO);

    expect(repo.marcarNotificados).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('No hay socios en espera para la clase 30');
  });

  it('un fallo de la base se loguea y no se propaga (no rompe la cancelacion que lo disparo)', async () => {
    const { observer, repo } = armar(2);
    repo.marcarNotificados.mockRejectedValue(new Error('se cayo la conexion'));

    await expect(observer.notificarCupoDisponible(EVENTO)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('se cayo la conexion'));
  });
});
