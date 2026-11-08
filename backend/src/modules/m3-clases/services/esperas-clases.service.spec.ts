import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemException } from '../../../commons/filters/problem.exception';
import type { MembresiasService } from '../../m1-usuarios/services/membresias.service';
import type { EsperaClase } from '../entities/espera-clase.entity';
import type { ClaseRepository } from '../repositories/clase.repository';
import type { EsperaClaseRepository } from '../repositories/espera-clase.repository';
import { EsperasClasesService } from './esperas-clases.service';

// RF-08: lista de espera de una clase completa. El socio se anota EN_ESPERA, al liberarse un cupo pasa a NOTIFICADO y el
// primero que confirma se queda con el lugar (first-come). El lock de la confirmacion esta en la integracion.
const INICIO = new Date('2026-11-10T18:00:00-03:00');
const CLASE = { id: 30, sedeId: 1, tipo: 'Yoga', horarioInicio: INICIO, capacidad: 10, cupoDisponible: 0 };

function espera(over: Partial<EsperaClase> = {}): EsperaClase {
  return {
    id: 40,
    claseId: 30,
    socioId: 7,
    estado: 'EN_ESPERA',
    fechaAnotacion: new Date('2026-11-09T10:00:00-03:00'),
    fechaNotificacion: null,
    fechaConfirmacion: null,
    ...over,
  };
}

function armar() {
  const esperasRepo = {
    listar: vi.fn().mockResolvedValue({ items: [espera()], total: 1 }),
    crear: vi.fn().mockResolvedValue({ ok: true, espera: espera() }),
    buscarPorId: vi.fn().mockResolvedValue(espera()),
    marcarCancelada: vi.fn().mockResolvedValue(undefined),
    confirmarEsperaConLock: vi.fn(),
  };
  const clasesRepo = { buscarPorId: vi.fn().mockResolvedValue(CLASE) };
  const membresias = { consultarVigenciaPorSocio: vi.fn().mockResolvedValue({ esSocio: true, vigente: true, enMora: false }) };
  const service = new EsperasClasesService(
    esperasRepo as unknown as EsperaClaseRepository,
    clasesRepo as unknown as ClaseRepository,
    membresias as unknown as MembresiasService,
  );
  return { service, esperasRepo, clasesRepo, membresias };
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

describe('EsperasClasesService (RF-08)', () => {
  let m: ReturnType<typeof armar>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T12:00:00-03:00'));
    m = armar();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('anotarseEnEspera', () => {
    it('anota al socio vigente EN_ESPERA con la fecha de anotacion', async () => {
      const res = await m.service.anotarseEnEspera(30, { socioId: 7 } as never);

      expect(m.esperasRepo.crear).toHaveBeenCalledWith({
        claseId: 30,
        socioId: 7,
        estado: 'EN_ESPERA',
        fechaAnotacion: new Date('2026-11-09T12:00:00-03:00'),
      });
      expect(res).toMatchObject({ id: 40, estado: 'EN_ESPERA' });
    });

    it('409 cupo-disponible: solo se entra a la espera si la clase esta completa', async () => {
      m.clasesRepo.buscarPorId.mockResolvedValue({ ...CLASE, cupoDisponible: 3 });
      m.esperasRepo.crear.mockResolvedValue({ ok: false, motivo: 'CUPO_DISPONIBLE' });

      expect(await problemaDe(m.service.anotarseEnEspera(30, { socioId: 7 } as never))).toEqual({
        status: 409,
        type: 'https://fitzone.app/errores/cupo-disponible',
      });
    });

    it('409 espera-existente si ya estaba anotado', async () => {
      m.esperasRepo.crear.mockResolvedValue({ ok: false, motivo: 'ESPERA_EXISTENTE' });

      expect((await problemaDe(m.service.anotarseEnEspera(30, { socioId: 7 } as never))).type).toBe(
        'https://fitzone.app/errores/espera-existente',
      );
    });

    it('404 si la clase desaparece entre la lectura y el alta', async () => {
      m.esperasRepo.crear.mockResolvedValue({ ok: false, motivo: 'CLASE_INEXISTENTE' });
      expect((await problemaDe(m.service.anotarseEnEspera(30, { socioId: 7 } as never))).status).toBe(404);
    });

    it('404 si la clase no existe', async () => {
      m.clasesRepo.buscarPorId.mockResolvedValue(null);
      expect((await problemaDe(m.service.anotarseEnEspera(30, { socioId: 7 } as never))).status).toBe(404);
    });

    it('409 clase-pasada si la clase ya empezo', async () => {
      vi.setSystemTime(INICIO);

      expect((await problemaDe(m.service.anotarseEnEspera(30, { socioId: 7 } as never))).type).toBe(
        'https://fitzone.app/errores/clase-pasada',
      );
      expect(m.membresias.consultarVigenciaPorSocio).not.toHaveBeenCalled();
    });

    it('404 si el socio no existe', async () => {
      m.membresias.consultarVigenciaPorSocio.mockResolvedValue({ esSocio: false, vigente: false, enMora: false });
      expect((await problemaDe(m.service.anotarseEnEspera(30, { socioId: 7 } as never))).status).toBe(404);
    });

    it('403 socio-en-mora si la membresia no esta al dia (RN-03), sin anotarlo', async () => {
      m.membresias.consultarVigenciaPorSocio.mockResolvedValue({ esSocio: true, vigente: false, enMora: true });

      expect(await problemaDe(m.service.anotarseEnEspera(30, { socioId: 7 } as never))).toEqual({
        status: 403,
        type: 'https://fitzone.app/errores/socio-en-mora',
      });
      expect(m.esperasRepo.crear).not.toHaveBeenCalled();
    });
  });

  describe('confirmarEspera (first-come)', () => {
    it('el notificado que confirma se queda con la reserva', async () => {
      m.esperasRepo.confirmarEsperaConLock.mockResolvedValue({
        ok: true,
        reserva: { id: 71, claseId: 30, socioId: 7, estado: 'CONFIRMADA' },
      });

      expect(await m.service.confirmarEspera(40)).toMatchObject({ id: 71, estado: 'CONFIRMADA' });
    });

    it.each([
      ['ESPERA_INEXISTENTE', 404, 'about:blank'],
      ['NO_NOTIFICADA', 409, 'https://fitzone.app/errores/espera-no-notificada'],
      ['CUPO_TOMADO', 409, 'https://fitzone.app/errores/cupo-tomado'],
      ['RESERVA_DUPLICADA', 409, 'https://fitzone.app/errores/reserva-duplicada'],
    ])('traduce el motivo %s', async (motivo, status, type) => {
      m.esperasRepo.confirmarEsperaConLock.mockResolvedValue({ ok: false, motivo });

      expect(await problemaDe(m.service.confirmarEspera(40))).toEqual({ status, type });
    });
  });

  describe('salirDeEspera', () => {
    it.each(['EN_ESPERA', 'NOTIFICADO'] as const)('desde %s se cancela', async (estado) => {
      m.esperasRepo.buscarPorId.mockResolvedValue(espera({ estado }));

      await m.service.salirDeEspera(40);

      expect(m.esperasRepo.marcarCancelada).toHaveBeenCalledWith(40);
    });

    it('409 si ya confirmo (ahora es una reserva, se cancela por ahi)', async () => {
      m.esperasRepo.buscarPorId.mockResolvedValue(espera({ estado: 'CONFIRMADO' }));

      expect((await problemaDe(m.service.salirDeEspera(40))).type).toBe('https://fitzone.app/errores/espera-confirmada');
      expect(m.esperasRepo.marcarCancelada).not.toHaveBeenCalled();
    });

    it('salir de una espera ya cancelada no hace nada', async () => {
      m.esperasRepo.buscarPorId.mockResolvedValue(espera({ estado: 'CANCELADO' }));

      await m.service.salirDeEspera(40);

      expect(m.esperasRepo.marcarCancelada).not.toHaveBeenCalled();
    });

    it('404 si no existe', async () => {
      m.esperasRepo.buscarPorId.mockResolvedValue(null);
      expect((await problemaDe(m.service.salirDeEspera(40))).status).toBe(404);
    });
  });

  describe('consultas', () => {
    it('la cola de una clase exige que la clase exista', async () => {
      await m.service.listarEsperaDeClase(30, { estado: 'NOTIFICADO' } as never);
      expect(m.esperasRepo.listar).toHaveBeenCalledWith({ claseId: 30, estado: 'NOTIFICADO' }, { page: 1, perPage: 20 });

      m.clasesRepo.buscarPorId.mockResolvedValue(null);
      expect((await problemaDe(m.service.listarEsperaDeClase(99, {} as never))).status).toBe(404);
    });

    it('el listado general filtra por clase, socio y estado', async () => {
      const res = await m.service.listarEsperasClase({ socioId: 7, page: 2, perPage: 5 } as never);

      expect(m.esperasRepo.listar).toHaveBeenCalledWith(
        { claseId: undefined, socioId: 7, estado: undefined },
        { page: 2, perPage: 5 },
      );
      expect(res.total).toBe(1);
    });

    it('obtenerEspera devuelve la espera o 404', async () => {
      m.esperasRepo.buscarPorId.mockResolvedValueOnce(espera()).mockResolvedValueOnce(null);

      expect(await m.service.obtenerEspera(40)).toMatchObject({ id: 40 });
      expect((await problemaDe(m.service.obtenerEspera(40))).status).toBe(404);
    });
  });
});
