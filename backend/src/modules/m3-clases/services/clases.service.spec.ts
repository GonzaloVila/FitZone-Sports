import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemException } from '../../../commons/filters/problem.exception';
import type { SedesService } from '../../m2-gimnasio/services/sedes.service';
import type { ClaseRepository } from '../repositories/clase.repository';
import { ClasesService } from './clases.service';

// RF-06: agenda de clases grupales por sede. Repositorio y M2 mockeados; el reloj se fija para que "pasado" y "futuro"
// no dependan del dia en que corre el test.
const AHORA = new Date('2026-11-09T12:00:00-03:00');
const ALTA = {
  sedeId: 1,
  tipo: 'Spinning',
  instructor: 'Laura',
  horarioInicio: '2026-11-10T18:00:00-03:00',
  horarioFin: '2026-11-10T19:00:00-03:00',
  capacidad: 15,
};

function armar() {
  const clasesRepo = {
    crear: vi.fn().mockImplementation(async (nueva: object) => ({ id: 30, ...nueva })),
    listar: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    buscarPorId: vi.fn(),
  };
  const sedes = { existe: vi.fn().mockResolvedValue(true) };
  const service = new ClasesService(clasesRepo as unknown as ClaseRepository, sedes as unknown as SedesService);
  return { service, clasesRepo, sedes };
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

describe('ClasesService (RF-06)', () => {
  let m: ReturnType<typeof armar>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    m = armar();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('crearClase', () => {
    it('crea la clase con su rango horario y arranca con todo el cupo libre', async () => {
      const res = await m.service.crearClase(ALTA as never);

      expect(m.clasesRepo.crear).toHaveBeenCalledWith({
        sedeId: 1,
        tipo: 'Spinning',
        instructor: 'Laura',
        horarioInicio: new Date(ALTA.horarioInicio),
        horarioFin: new Date(ALTA.horarioFin),
        capacidad: 15,
      });
      expect(res).toMatchObject({ id: 30, capacidad: 15, reservasConfirmadas: 0, cupoDisponible: 15 });
    });

    it('404 si la sede no existe', async () => {
      m.sedes.existe.mockResolvedValue(false);

      expect((await problemaDe(m.service.crearClase(ALTA as never))).status).toBe(404);
      expect(m.clasesRepo.crear).not.toHaveBeenCalled();
    });

    it('rechaza fechas que no se pueden interpretar', async () => {
      expect(await problemaDe(m.service.crearClase({ ...ALTA, horarioInicio: 'mañana' } as never))).toEqual({
        status: 409,
        type: 'https://fitzone.app/errores/fecha-invalida',
      });
    });

    it.each([
      ['termina antes de empezar', '2026-11-10T17:00:00-03:00'],
      ['dura cero minutos', '2026-11-10T18:00:00-03:00'],
    ])('422 rango-horario-invalido si %s', async (_caso, fin) => {
      expect(await problemaDe(m.service.crearClase({ ...ALTA, horarioFin: fin } as never))).toEqual({
        status: 422,
        type: 'https://fitzone.app/errores/rango-horario-invalido',
      });
    });

    it('409 clase-pasada si el horario ya paso (o es justo ahora)', async () => {
      const pasada = { ...ALTA, horarioInicio: '2026-11-09T12:00:00-03:00', horarioFin: '2026-11-09T13:00:00-03:00' };

      expect((await problemaDe(m.service.crearClase(pasada as never))).type).toBe('https://fitzone.app/errores/clase-pasada');
      expect(m.clasesRepo.crear).not.toHaveBeenCalled();
    });
  });

  describe('listarClases y obtenerClase', () => {
    it('lista con los filtros pedidos y paginacion por defecto 1/20', async () => {
      await m.service.listarClases({ sedeId: 1, tipo: 'Yoga', estado: 'CON_CUPOS' } as never);

      expect(m.clasesRepo.listar).toHaveBeenCalledWith(
        { sedeId: 1, tipo: 'Yoga', estado: 'CON_CUPOS' },
        { page: 1, perPage: 20 },
      );
    });

    it('respeta la paginacion que pide el cliente', async () => {
      await m.service.listarClases({ page: 3, perPage: 5 } as never);

      expect(m.clasesRepo.listar).toHaveBeenCalledWith(expect.anything(), { page: 3, perPage: 5 });
    });

    it('obtenerClase devuelve la clase con su cupo o 404', async () => {
      m.clasesRepo.buscarPorId
        .mockResolvedValueOnce({ id: 30, capacidad: 15, reservasConfirmadas: 14, cupoDisponible: 1 })
        .mockResolvedValueOnce(null);

      expect(await m.service.obtenerClase(30)).toMatchObject({ id: 30, cupoDisponible: 1 });
      expect((await problemaDe(m.service.obtenerClase(30))).status).toBe(404);
    });
  });
});
