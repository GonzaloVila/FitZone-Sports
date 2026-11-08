import type { EventEmitter2 } from '@nestjs/event-emitter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTO_MEMBRESIA_PLAN } from '../../../commons/eventos';
import { ProblemException } from '../../../commons/filters/problem.exception';
import type { MembresiaRepository } from '../domain/membresia.port';
import { PRECIOS_PLAN } from '../entities/membresia.entity';
import type { Membresia } from '../entities/membresia.entity';
import type { SocioRepository } from '../repositories/socio.repository';
import { MembresiasService } from './membresias.service';

// Gestion de la membresia del socio (RF-02): consulta, PATCH de plan / estado / renovacion automatica, y lo que usan
// los crons y el puesto offline. Las consultas de vigencia (RN-03) estan en membresias.service.spec.ts.
function membresia(over: Partial<Membresia> = {}): Membresia {
  return {
    id: 9,
    socioId: 1,
    plan: 'MENSUAL',
    estado: 'ACTIVA',
    fechaInicio: new Date('2026-11-01T12:00:00Z'),
    fechaFin: new Date('2099-12-01T12:00:00Z'),
    precio: PRECIOS_PLAN.MENSUAL,
    renuevaAutomatica: true,
    updatedAt: new Date('2026-11-01T12:00:00Z'),
    ...over,
  };
}

const VENCIDA = membresia({ estado: 'VENCIDA', fechaFin: new Date('2026-10-01T12:00:00Z') });

function armar(previa: Membresia | null = membresia()) {
  const membresias = {
    buscarPorSocioId: vi.fn().mockResolvedValue(previa),
    actualizar: vi.fn().mockImplementation(async (_socioId: number, cambios: object) => (previa ? { ...previa, ...cambios } : null)),
    buscarNoVigentes: vi.fn(),
    listarRenovables: vi.fn(),
    renovar: vi.fn(),
  };
  const socios = { buscarPorId: vi.fn().mockResolvedValue({ id: 1, usuarioId: 50 }) };
  const eventos = { emitAsync: vi.fn().mockResolvedValue([]) };
  const service = new MembresiasService(
    membresias as unknown as MembresiaRepository,
    socios as unknown as SocioRepository,
    eventos as unknown as EventEmitter2,
  );
  return { service, membresias, socios, eventos };
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

describe('MembresiasService - gestion de la membresia (RF-02)', () => {
  let m: ReturnType<typeof armar>;

  beforeEach(() => {
    m = armar();
  });

  describe('obtenerPorSocioId', () => {
    it('devuelve la membresia del socio', async () => {
      expect(await m.service.obtenerPorSocioId(1)).toMatchObject({ id: 9, plan: 'MENSUAL', estado: 'ACTIVA' });
    });

    it('404 si el socio no existe', async () => {
      m.socios.buscarPorId.mockResolvedValue(null);
      expect(await statusDe(m.service.obtenerPorSocioId(1))).toBe(404);
    });

    it('404 si el socio no tiene membresia', async () => {
      m.membresias.buscarPorSocioId.mockResolvedValue(null);
      expect(await statusDe(m.service.obtenerPorSocioId(1))).toBe(404);
    });
  });

  describe('modificar: validaciones', () => {
    it('404 si el socio no existe', async () => {
      m.socios.buscarPorId.mockResolvedValue(null);
      expect(await statusDe(m.service.modificar(1, { plan: 'ANUAL' } as never))).toBe(404);
    });

    it('422 si el PATCH no trae ningun campo, sin tocar la base', async () => {
      expect(await statusDe(m.service.modificar(1, {} as never))).toBe(422);
      expect(m.membresias.actualizar).not.toHaveBeenCalled();
    });

    it('404 si el repositorio no encuentra la membresia al actualizar', async () => {
      m.membresias.actualizar.mockResolvedValue(null);
      expect(await statusDe(m.service.modificar(1, { renuevaAutomatica: false } as never))).toBe(404);
    });
  });

  describe('modificar: cambio de plan', () => {
    it('sobre una membresia vigente cambia el plan sin cobrar', async () => {
      const res = await m.service.modificar(1, { plan: 'ANUAL' } as never);

      expect(m.eventos.emitAsync).not.toHaveBeenCalled();
      expect(m.membresias.actualizar).toHaveBeenCalledWith(1, { plan: 'ANUAL' });
      expect(res).toMatchObject({ plan: 'ANUAL' });
    });

    it('sobre una membresia vencida cobra el plan NUEVO (aviso a M5) antes de actualizar', async () => {
      m = armar(VENCIDA);

      await m.service.modificar(1, { plan: 'TRIMESTRAL' } as never);

      expect(m.eventos.emitAsync).toHaveBeenCalledWith(EVENTO_MEMBRESIA_PLAN, {
        membresiaId: 9,
        usuarioId: 50,
        precio: PRECIOS_PLAN.TRIMESTRAL,
        plan: 'TRIMESTRAL',
      });
      expect(m.eventos.emitAsync.mock.invocationCallOrder[0]).toBeLessThan(m.membresias.actualizar.mock.invocationCallOrder[0]);
    });

    it('si el cobro se rechaza, el error sube y la membresia no se modifica', async () => {
      m = armar(VENCIDA);
      m.eventos.emitAsync.mockRejectedValue(new ProblemException({ type: 'pago', title: 'Pago rechazado', status: 402 }));

      expect(await statusDe(m.service.modificar(1, { plan: 'TRIMESTRAL' } as never))).toBe(402);
      expect(m.membresias.actualizar).not.toHaveBeenCalled();
    });

    it('cambiar solo la renovacion automatica de una vencida no cobra nada', async () => {
      m = armar(VENCIDA);

      await m.service.modificar(1, { renuevaAutomatica: false } as never);

      expect(m.eventos.emitAsync).not.toHaveBeenCalled();
    });
  });

  describe('modificar: estado (lo decide la maquina de estados)', () => {
    it.each([
      ['ACTIVA', 'SUSPENDIDA', 'SUSPENDIDA'],
      ['ACTIVA', 'ACTIVA', 'ACTIVA'],
      ['SUSPENDIDA', 'ACTIVA', 'ACTIVA'],
      ['SUSPENDIDA', 'SUSPENDIDA', 'SUSPENDIDA'],
      ['VENCIDA', 'SUSPENDIDA', 'SUSPENDIDA'],
    ] as const)('de %s, pedir %s deja %s', async (actual, pedido, resultado) => {
      m = armar(membresia({ estado: actual }));

      await m.service.modificar(1, { estado: pedido } as never);

      expect(m.membresias.actualizar).toHaveBeenCalledWith(1, expect.objectContaining({ estado: resultado }));
    });

    it('sin membresia previa pasa el estado pedido tal cual (el repositorio decide el 404)', async () => {
      m = armar(null);

      expect(await statusDe(m.service.modificar(1, { estado: 'SUSPENDIDA' } as never))).toBe(404);
      expect(m.membresias.actualizar).toHaveBeenCalledWith(1, { estado: 'SUSPENDIDA' });
    });
  });

  describe('lo que usan los crons y el puesto offline', () => {
    it('buscarNoVigentes delega con la fecha de corte (lista de bloqueados, RNF-01)', async () => {
      const desde = new Date('2026-11-01T00:00:00Z');
      m.membresias.buscarNoVigentes.mockResolvedValue([{ socioId: 3, motivo: 'VENCIDA', desde }]);

      expect(await m.service.buscarNoVigentes(desde)).toEqual([{ socioId: 3, motivo: 'VENCIDA', desde }]);
      expect(m.membresias.buscarNoVigentes).toHaveBeenCalledWith(desde);
    });

    it('listarRenovables delega con la fecha de la corrida', async () => {
      const ahora = new Date('2026-11-09T03:00:00Z');
      m.membresias.listarRenovables.mockResolvedValue([]);

      await m.service.listarRenovables(ahora);

      expect(m.membresias.listarRenovables).toHaveBeenCalledWith(ahora);
    });

    it('renovar persiste el periodo nuevo y devuelve la membresia', async () => {
      const periodo = { fechaInicio: new Date('2026-12-01T12:00:00Z'), fechaFin: new Date('2027-01-01T12:00:00Z') };
      m.membresias.renovar.mockResolvedValue(membresia(periodo));

      expect(await m.service.renovar(9, periodo)).toMatchObject(periodo);
      expect(m.membresias.renovar).toHaveBeenCalledWith(9, periodo);
    });

    it('renovar una membresia inexistente da 404', async () => {
      m.membresias.renovar.mockResolvedValue(null);
      expect(await statusDe(m.service.renovar(9, { fechaInicio: new Date(), fechaFin: new Date() }))).toBe(404);
    });
  });
});
