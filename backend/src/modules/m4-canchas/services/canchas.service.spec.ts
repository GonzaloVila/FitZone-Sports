import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemException } from '../../../commons/filters/problem.exception';
import type { SedesService } from '../../m2-gimnasio/services/sedes.service';
import type { Cancha } from '../entities/cancha.entity';
import type { CanchaRepository } from '../repositories/cancha.repository';
import { CanchasService } from './canchas.service';

// RF-09: gestion de canchas por sede (alta, listado, edicion de costo y estado). El CRUD contra la base real esta en
// canchas.service.integration-spec.ts; aca van las reglas del service con el repositorio y M2 mockeados.
const CANCHA: Cancha = { id: 11, sedeId: 1, tipo: 'PADDLE', costoPorHora: 12000, estado: 'OPERATIVA' };

function armar() {
  const canchas = {
    crear: vi.fn().mockResolvedValue(CANCHA),
    listarPorSede: vi.fn().mockResolvedValue({ items: [CANCHA], total: 1 }),
    buscar: vi.fn().mockResolvedValue({ items: [CANCHA], total: 1 }),
    buscarPorId: vi.fn(),
    actualizar: vi.fn(),
  };
  const sedes = { existe: vi.fn().mockResolvedValue(true) };
  const service = new CanchasService(canchas as unknown as CanchaRepository, sedes as unknown as SedesService);
  return { service, canchas, sedes };
}

async function statusDe(promesa: Promise<unknown>): Promise<number> {
  try {
    await promesa;
  } catch (error) {
    expect(error).toBeInstanceOf(ProblemException);
    return (error as ProblemException).getStatus();
  }
  throw new Error('se esperaba un error de dominio');
}

describe('CanchasService (RF-09)', () => {
  let m: ReturnType<typeof armar>;

  beforeEach(() => {
    m = armar();
  });

  describe('crear', () => {
    it('da de alta la cancha en la sede con su costo por hora', async () => {
      const res = await m.service.crear(1, { tipo: 'PADDLE', costoPorHora: 12000, estado: 'OPERATIVA' } as never);

      expect(res).toMatchObject(CANCHA);
      expect(m.canchas.crear).toHaveBeenCalledWith({ sedeId: 1, tipo: 'PADDLE', costoPorHora: 12000, estado: 'OPERATIVA' });
    });

    it('sin estado, la cancha nace OPERATIVA', async () => {
      await m.service.crear(1, { tipo: 'FUTBOL5', costoPorHora: 20000 } as never);

      expect(m.canchas.crear).toHaveBeenCalledWith(expect.objectContaining({ estado: 'OPERATIVA' }));
    });

    it('404 si la sede no existe, sin crear nada', async () => {
      m.sedes.existe.mockResolvedValue(false);

      expect(await statusDe(m.service.crear(99, { tipo: 'PADDLE', costoPorHora: 1 } as never))).toBe(404);
      expect(m.canchas.crear).not.toHaveBeenCalled();
    });
  });

  describe('listar y buscar', () => {
    it('listar exige que la sede exista (el contrato declara 404 tambien en el listado)', async () => {
      m.sedes.existe.mockResolvedValue(false);

      expect(await statusDe(m.service.listar(99, { page: 1, perPage: 10 }))).toBe(404);
      expect(m.canchas.listarPorSede).not.toHaveBeenCalled();
    });

    it('listar pasa los filtros al repositorio y devuelve items y total', async () => {
      const res = await m.service.listar(1, { estado: 'EN_MANTENIMIENTO', page: 2, perPage: 5 });

      expect(m.canchas.listarPorSede).toHaveBeenCalledWith(1, { estado: 'EN_MANTENIMIENTO', page: 2, perPage: 5 });
      expect(res.total).toBe(1);
    });

    it('buscar no consulta la sede: un sedeId inexistente da lista vacia, no 404', async () => {
      m.canchas.buscar.mockResolvedValue({ items: [], total: 0 });

      expect(await m.service.buscar({ sedeId: 99, page: 1, perPage: 10 })).toEqual({ items: [], total: 0 });
      expect(m.sedes.existe).not.toHaveBeenCalled();
    });
  });

  describe('obtener', () => {
    it('devuelve la cancha o 404', async () => {
      m.canchas.buscarPorId.mockResolvedValueOnce(CANCHA).mockResolvedValueOnce(null);

      expect(await m.service.obtener(11)).toMatchObject({ id: 11 });
      expect(await statusDe(m.service.obtener(11))).toBe(404);
    });
  });

  describe('actualizar', () => {
    it('cambia el costo por hora (lo configura el gerente)', async () => {
      m.canchas.actualizar.mockResolvedValue({ ...CANCHA, costoPorHora: 15000 });

      expect(await m.service.actualizar(11, { costoPorHora: 15000 } as never)).toMatchObject({ costoPorHora: 15000 });
      expect(m.canchas.actualizar).toHaveBeenCalledWith(11, { costoPorHora: 15000, estado: undefined });
    });

    it('pasa la cancha a mantenimiento', async () => {
      m.canchas.actualizar.mockResolvedValue({ ...CANCHA, estado: 'EN_MANTENIMIENTO' });

      expect(await m.service.actualizar(11, { estado: 'EN_MANTENIMIENTO' } as never)).toMatchObject({
        estado: 'EN_MANTENIMIENTO',
      });
    });

    it('422 si el PATCH no trae ningun campo, sin tocar la base', async () => {
      expect(await statusDe(m.service.actualizar(11, {} as never))).toBe(422);
      expect(m.canchas.actualizar).not.toHaveBeenCalled();
    });

    it('404 si la cancha no existe', async () => {
      m.canchas.actualizar.mockResolvedValue(null);

      expect(await statusDe(m.service.actualizar(99, { costoPorHora: 1 } as never))).toBe(404);
    });
  });
});
