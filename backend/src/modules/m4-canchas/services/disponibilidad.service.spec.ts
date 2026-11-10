import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemException } from '../../../commons/filters/problem.exception';
import type { ReservaRepository } from '../domain/reserva.port';
import type { Cancha } from '../entities/cancha.entity';
import type { CanchaRepository } from '../repositories/cancha.repository';
import { DisponibilidadService } from './disponibilidad.service';

// RF-10: grilla de turnos de una cancha para un dia, de 08:00 a 22:00 en tramos de 60 minutos, en hora de la sede
// (UTC-3). Un tramo esta disponible si es futuro, la cancha no esta en mantenimiento y ninguna reserva activa lo pisa.
const FECHA = '2026-12-02';
const local = (hhmm: string) => new Date(`${FECHA}T${hhmm}:00-03:00`);
const TODA_LA_GRILLA = { page: 1, perPage: 50 };
const OPERATIVA: Cancha = { id: 5, sedeId: 1, tipo: 'FUTBOL5', costoPorHora: 20000, estado: 'OPERATIVA' };

function reserva(desde: string, hasta: string) {
  return { fechaHoraInicio: local(desde), fechaHoraFin: local(hasta) };
}

function armar(cancha: Cancha | null = OPERATIVA, ocupadas: ReturnType<typeof reserva>[] = []) {
  const canchas = { buscarPorId: vi.fn().mockResolvedValue(cancha) };
  const reservas = { listarOcupadasEnRango: vi.fn().mockResolvedValue(ocupadas) };
  const service = new DisponibilidadService(
    canchas as unknown as CanchaRepository,
    reservas as unknown as ReservaRepository,
  );
  return { service, canchas, reservas };
}

function disponibilidadPorHora(items: { fechaHoraInicio: Date; disponible: boolean }[]): Record<string, boolean> {
  return Object.fromEntries(
    items.map((t) => [
      new Date(t.fechaHoraInicio.getTime() - 3 * 3_600_000).toISOString().slice(11, 16),
      t.disponible,
    ]),
  );
}

describe('DisponibilidadService (RF-12)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // El dia anterior: toda la grilla del dia consultado es futura.
    vi.setSystemTime(new Date('2026-12-01T12:00:00-03:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('grilla', () => {
    it('arma 14 tramos de una hora entre las 08:00 y las 22:00 de la sede', async () => {
      const { service } = armar();

      const { items, total } = await service.consultar(5, FECHA, TODA_LA_GRILLA);

      expect(total).toBe(14);
      expect(items[0]).toMatchObject({ fechaHoraInicio: local('08:00'), fechaHoraFin: local('09:00') });
      expect(items[13]).toMatchObject({ fechaHoraInicio: local('21:00'), fechaHoraFin: local('22:00') });
      expect(items.every((t) => t.disponible)).toBe(true);
    });

    it('consulta las reservas solo del dia pedido, en hora de la sede', async () => {
      const { service, reservas } = armar();

      await service.consultar(5, FECHA, TODA_LA_GRILLA);

      expect(reservas.listarOcupadasEnRango).toHaveBeenCalledWith(5, local('00:00'), new Date('2026-12-03T00:00:00-03:00'));
    });

    it('pagina la grilla sin cambiar el total', async () => {
      const { service } = armar();

      const { items, total } = await service.consultar(5, FECHA, { page: 2, perPage: 5 });

      expect(total).toBe(14);
      expect(items).toHaveLength(5);
      expect(items[0].fechaHoraInicio).toEqual(local('13:00'));
    });
  });

  describe('ocupacion', () => {
    it('una reserva ocupa los tramos que pisa y nada mas', async () => {
      const { service } = armar(OPERATIVA, [reserva('19:00', '21:00')]);

      const porHora = disponibilidadPorHora((await service.consultar(5, FECHA, TODA_LA_GRILLA)).items);

      expect(porHora).toMatchObject({ '18:00': true, '19:00': false, '20:00': false, '21:00': true });
    });

    it('una reserva que no arranca en punto ocupa los dos tramos que toca', async () => {
      const { service } = armar(OPERATIVA, [reserva('10:30', '11:30')]);

      const porHora = disponibilidadPorHora((await service.consultar(5, FECHA, TODA_LA_GRILLA)).items);

      expect(porHora).toMatchObject({ '09:00': true, '10:00': false, '11:00': false, '12:00': true });
    });

    it('intervalos semiabiertos: una reserva que termina cuando empieza el tramo no lo ocupa', async () => {
      const { service } = armar(OPERATIVA, [reserva('07:00', '08:00')]);

      const porHora = disponibilidadPorHora((await service.consultar(5, FECHA, TODA_LA_GRILLA)).items);

      expect(porHora['08:00']).toBe(true);
    });
  });

  describe('bloqueos', () => {
    it('en mantenimiento todo el dia queda bloqueado, sin leer las reservas', async () => {
      const { service, reservas } = armar({ ...OPERATIVA, estado: 'EN_MANTENIMIENTO' });

      const { items } = await service.consultar(5, FECHA, TODA_LA_GRILLA);

      expect(items.some((t) => t.disponible)).toBe(false);
      expect(reservas.listarOcupadasEnRango).not.toHaveBeenCalled();
    });

    it('los tramos que ya empezaron no se pueden reservar', async () => {
      vi.setSystemTime(local('15:10'));
      const { service } = armar();

      const porHora = disponibilidadPorHora((await service.consultar(5, FECHA, TODA_LA_GRILLA)).items);

      expect(porHora).toMatchObject({ '14:00': false, '15:00': false, '16:00': true });
    });

    it('404 si la cancha no existe', async () => {
      const { service } = armar(null);

      await expect(service.consultar(99, FECHA, TODA_LA_GRILLA)).rejects.toBeInstanceOf(ProblemException);
      await expect(service.consultar(99, FECHA, TODA_LA_GRILLA)).rejects.toMatchObject({ status: 404 });
    });
  });
});
