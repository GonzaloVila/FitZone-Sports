import type { EventEmitter2 } from '@nestjs/event-emitter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTO_CUPO_LIBERADO, EVENTO_RESERVA_CLASE_CANCELADA_TARDIA } from '../../../commons/eventos';
import { ProblemException } from '../../../commons/filters/problem.exception';
import type { MembresiasService } from '../../m1-usuarios/services/membresias.service';
import type { ReservaClase } from '../entities/reserva-clase.entity';
import type { ClaseRepository } from '../repositories/clase.repository';
import type { ReservaClaseRepository } from '../repositories/reserva-clase.repository';
import type { ValidadorDeReservas } from '../validaciones/validador-de-reservas';
import { ReservasClasesService } from './reservas-clases.service';

// RF-07: reserva y cancelacion de clases. La penalidad del 50% por cancelar con menos de 2 h la cobra M5 escuchando un
// evento; el cupo liberado se publica para la lista de espera (RF-08). El lock real del cupo esta en la integracion.
const INICIO = new Date('2026-11-10T18:00:00-03:00');
const FIN = new Date('2026-11-10T19:00:00-03:00');
const CLASE = { id: 30, sedeId: 1, tipo: 'Spinning', instructor: 'Laura', horarioInicio: INICIO, horarioFin: FIN, capacidad: 15 };
const HORA = 3_600_000;

function reserva(over: Partial<ReservaClase> = {}): ReservaClase {
  return { id: 70, claseId: 30, socioId: 7, estado: 'CONFIRMADA', horarioInicio: INICIO, horarioFin: FIN, ...over };
}

function armar() {
  const reservasRepo = {
    listar: vi.fn().mockResolvedValue({ items: [reserva()], total: 1 }),
    crearConLock: vi.fn().mockResolvedValue({ ok: true, reserva: reserva() }),
    buscarPorId: vi.fn().mockResolvedValue(reserva()),
    marcarCancelada: vi.fn().mockResolvedValue(undefined),
  };
  const clasesRepo = { buscarPorId: vi.fn().mockResolvedValue(CLASE) };
  const estadoSocio = { esSocio: true, vigente: true, enMora: false };
  const membresias = { consultarVigenciaPorSocio: vi.fn().mockResolvedValue(estadoSocio) };
  const eventos = { emitAsync: vi.fn().mockResolvedValue([]) };
  const validador = { validar: vi.fn() };
  const service = new ReservasClasesService(
    reservasRepo as unknown as ReservaClaseRepository,
    clasesRepo as unknown as ClaseRepository,
    membresias as unknown as MembresiasService,
    eventos as unknown as EventEmitter2,
    validador as unknown as ValidadorDeReservas,
  );
  return { service, reservasRepo, clasesRepo, membresias, eventos, validador, estadoSocio };
}

async function problemaDe(promesa: Promise<unknown>): Promise<{ status: number; type: string }> {
  try {
    await promesa;
  } catch (error) {
    expect(error).toBeInstanceOf(ProblemException);
    const p = error as ProblemException;
    return { status: p.getStatus(), type: (p.getResponse() as { type: string }).type };
  }
  throw new Error('se esperaba un error de dominio');
}

const eventosEmitidos = (m: ReturnType<typeof armar>) => m.eventos.emitAsync.mock.calls.map(([nombre]) => nombre);

describe('ReservasClasesService', () => {
  let m: ReturnType<typeof armar>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(INICIO.getTime() - 24 * HORA));
    m = armar();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('crearReservaClase (RF-07)', () => {
    it('valida con la clase y la vigencia del socio, y reserva con lock', async () => {
      const res = await m.service.crearReservaClase(30, { socioId: 7 } as never);

      expect(m.validador.validar).toHaveBeenCalledWith({ claseId: 30, socioId: 7, clase: CLASE, estadoSocio: m.estadoSocio });
      expect(m.reservasRepo.crearConLock).toHaveBeenCalledWith(30, 7);
      expect(res).toMatchObject({ id: 70, estado: 'CONFIRMADA' });
    });

    it('si la cadena de validaciones corta (por ejemplo socio en mora), no se toca el cupo', async () => {
      m.validador.validar.mockImplementation(() => {
        throw new ProblemException({ type: 'https://fitzone.app/errores/socio-en-mora', title: 'Mora', status: 403 });
      });

      expect((await problemaDe(m.service.crearReservaClase(30, { socioId: 7 } as never))).status).toBe(403);
      expect(m.reservasRepo.crearConLock).not.toHaveBeenCalled();
    });

    it.each([
      ['CUPO_AGOTADO', 409, 'https://fitzone.app/errores/cupo-agotado'],
      ['RESERVA_DUPLICADA', 409, 'https://fitzone.app/errores/reserva-duplicada'],
      ['CLASE_INEXISTENTE', 404, 'about:blank'],
    ])('traduce el motivo %s del repositorio', async (motivo, status, type) => {
      m.reservasRepo.crearConLock.mockResolvedValue({ ok: false, motivo });

      expect(await problemaDe(m.service.crearReservaClase(30, { socioId: 7 } as never))).toEqual({ status, type });
    });
  });

  describe('cancelarReservaClase: penalidad (RF-07)', () => {
    it('con mas de 2 h de anticipacion cancela sin penalidad y libera el cupo', async () => {
      vi.setSystemTime(new Date(INICIO.getTime() - 3 * HORA));

      await m.service.cancelarReservaClase(70);

      expect(eventosEmitidos(m)).toEqual([EVENTO_CUPO_LIBERADO]);
      expect(m.reservasRepo.marcarCancelada).toHaveBeenCalledWith(70);
    });

    it('justo a las 2 h todavia no hay penalidad', async () => {
      vi.setSystemTime(new Date(INICIO.getTime() - 2 * HORA));

      await m.service.cancelarReservaClase(70);

      expect(eventosEmitidos(m)).not.toContain(EVENTO_RESERVA_CLASE_CANCELADA_TARDIA);
    });

    it('con menos de 2 h pide a M5 el cobro de la penalidad antes de cancelar', async () => {
      vi.setSystemTime(new Date(INICIO.getTime() - 2 * HORA + 1000));

      await m.service.cancelarReservaClase(70);

      expect(m.eventos.emitAsync).toHaveBeenNthCalledWith(1, EVENTO_RESERVA_CLASE_CANCELADA_TARDIA, {
        reservaClaseId: 70,
        socioId: 7,
      });
      expect(m.eventos.emitAsync.mock.invocationCallOrder[0]).toBeLessThan(m.reservasRepo.marcarCancelada.mock.invocationCallOrder[0]);
      expect(eventosEmitidos(m)).toEqual([EVENTO_RESERVA_CLASE_CANCELADA_TARDIA, EVENTO_CUPO_LIBERADO]);
    });

    it('si M5 rechaza el cobro de la penalidad (402), la reserva sigue confirmada y no se libera el cupo', async () => {
      vi.setSystemTime(new Date(INICIO.getTime() - 30 * 60_000));
      m.eventos.emitAsync.mockRejectedValueOnce(new ProblemException({ type: 'pago', title: 'Pago rechazado', status: 402 }));

      expect((await problemaDe(m.service.cancelarReservaClase(70))).status).toBe(402);
      expect(m.reservasRepo.marcarCancelada).not.toHaveBeenCalled();
      expect(eventosEmitidos(m)).not.toContain(EVENTO_CUPO_LIBERADO);
    });
  });

  describe('cancelarReservaClase: cupo liberado y casos borde', () => {
    it('publica el cupo liberado con los datos de la clase (RF-08, Observer)', async () => {
      await m.service.cancelarReservaClase(70);

      expect(m.eventos.emitAsync).toHaveBeenCalledWith(EVENTO_CUPO_LIBERADO, {
        claseId: 30,
        nombreClase: 'Spinning',
        horarioClase: INICIO.toISOString(),
        socioIdCancelador: 7,
        fechaLiberacion: expect.any(Date),
      });
    });

    it('cancelar una reserva ya cancelada no hace nada (idempotente)', async () => {
      m.reservasRepo.buscarPorId.mockResolvedValue(reserva({ estado: 'CANCELADA' }));

      await m.service.cancelarReservaClase(70);

      expect(m.reservasRepo.marcarCancelada).not.toHaveBeenCalled();
      expect(m.eventos.emitAsync).not.toHaveBeenCalled();
    });

    it('409 reserva-clase-pasada si la clase ya empezo', async () => {
      vi.setSystemTime(new Date(INICIO.getTime() + 10 * 60_000));

      expect((await problemaDe(m.service.cancelarReservaClase(70))).type).toBe(
        'https://fitzone.app/errores/reserva-clase-pasada',
      );
      expect(m.eventos.emitAsync).not.toHaveBeenCalled();
    });

    it('404 si la reserva no existe', async () => {
      m.reservasRepo.buscarPorId.mockResolvedValue(null);
      expect((await problemaDe(m.service.cancelarReservaClase(70))).status).toBe(404);
    });

    it('404 si la clase vinculada ya no existe', async () => {
      m.clasesRepo.buscarPorId.mockResolvedValue(null);
      expect((await problemaDe(m.service.cancelarReservaClase(70))).status).toBe(404);
      expect(m.reservasRepo.marcarCancelada).not.toHaveBeenCalled();
    });
  });

  describe('consultas', () => {
    it('una reserva de una clase que ya termino sale como CUMPLIDA (estado derivado)', async () => {
      vi.setSystemTime(new Date(FIN.getTime() + HORA));

      expect(await m.service.obtenerReservaClase(70)).toMatchObject({ estado: 'CUMPLIDA' });
    });

    it('obtenerReservaClase da 404 si no existe', async () => {
      m.reservasRepo.buscarPorId.mockResolvedValue(null);
      expect((await problemaDe(m.service.obtenerReservaClase(70))).status).toBe(404);
    });

    it('las reservas de una clase exigen que la clase exista y filtran por ella', async () => {
      await m.service.listarReservasDeClase(30, { estado: 'CONFIRMADA' } as never);
      expect(m.reservasRepo.listar).toHaveBeenCalledWith({ claseId: 30, estado: 'CONFIRMADA' }, { page: 1, perPage: 20 });

      m.clasesRepo.buscarPorId.mockResolvedValue(null);
      expect((await problemaDe(m.service.listarReservasDeClase(99, {} as never))).status).toBe(404);
    });

    it('el listado general pasa clase, socio y estado', async () => {
      const res = await m.service.listarReservasClase({ claseId: 30, socioId: 7, page: 2, perPage: 5 } as never);

      expect(m.reservasRepo.listar).toHaveBeenCalledWith(
        { claseId: 30, socioId: 7, estado: undefined },
        { page: 2, perPage: 5 },
      );
      expect(res.total).toBe(1);
    });
  });
});
