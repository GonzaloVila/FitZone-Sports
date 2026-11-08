import type { EventEmitter2 } from '@nestjs/event-emitter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTO_SOCIO_ALTA } from '../../../commons/eventos';
import { ProblemException } from '../../../commons/filters/problem.exception';
import { PRECIOS_PLAN } from '../entities/membresia.entity';
import type { Socio } from '../entities/socio.entity';
import type { SocioRepository } from '../repositories/socio.repository';
import type { UsuarioRepository } from '../repositories/usuario.repository';
import type { MembresiasService } from './membresias.service';
import { SociosService } from './socios.service';

// RF-01 / RF-02: alta de socio a partir de un usuario existente, con su membresia inicial cobrada por M5. Si el cobro
// se rechaza, el alta se compensa con una baja logica. La transaccion real (socio + membresia + rol) esta en la
// integracion; aca van las reglas del service con los repositorios mockeados.
const SOCIO: Socio = {
  id: 12,
  usuarioId: 50,
  nombre: 'Ana Socia',
  email: 'ana@fitzone.test',
  sedeOrigenId: 1,
  fechaAlta: new Date('2026-11-09T12:00:00Z'),
  activo: true,
  fechaBaja: null,
};

const ALTA = { usuarioId: 50, sedeOrigenId: 1, plan: 'TRIMESTRAL' as const };

function armar() {
  const socios = {
    crear: vi.fn().mockResolvedValue(SOCIO),
    marcarBaja: vi.fn().mockResolvedValue(undefined),
    listar: vi.fn().mockResolvedValue({ items: [SOCIO], total: 1 }),
    buscarPorId: vi.fn().mockResolvedValue(SOCIO),
    buscarPorUsuarioId: vi.fn().mockResolvedValue(SOCIO),
    actualizar: vi.fn(),
    buscarTotpPorUsuarioId: vi.fn(),
    buscarTotpPorSocioId: vi.fn(),
    guardarTotpSecreto: vi.fn().mockResolvedValue(undefined),
  };
  const usuarios = { buscarPorId: vi.fn().mockResolvedValue({ id: 50, rol: 'EXTERNO' }) };
  const membresias = { obtenerPorSocioId: vi.fn().mockResolvedValue({ id: 88 }) };
  const eventos = { emitAsync: vi.fn().mockResolvedValue([]) };
  const service = new SociosService(
    socios as unknown as SocioRepository,
    usuarios as unknown as UsuarioRepository,
    membresias as unknown as MembresiasService,
    eventos as unknown as EventEmitter2,
  );
  return { service, socios, usuarios, membresias, eventos };
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

describe('SociosService', () => {
  let m: ReturnType<typeof armar>;

  beforeEach(() => {
    m = armar();
  });

  describe('crear (RF-01 / RF-02)', () => {
    it('convierte al usuario en socio y pide a M5 el cobro de la membresia inicial', async () => {
      const res = await m.service.crear(ALTA as never);

      expect(m.socios.crear).toHaveBeenCalledWith({ usuarioId: 50, sedeOrigenId: 1, plan: 'TRIMESTRAL' });
      expect(m.eventos.emitAsync).toHaveBeenCalledWith(EVENTO_SOCIO_ALTA, {
        socioId: 12,
        membresiaId: 88,
        usuarioId: 50,
        precio: PRECIOS_PLAN.TRIMESTRAL,
        plan: 'TRIMESTRAL',
      });
      expect(res).toMatchObject({ id: 12, usuarioId: 50, email: 'ana@fitzone.test' });
      expect(m.socios.marcarBaja).not.toHaveBeenCalled();
    });

    it('404 si el usuario no existe, sin crear nada', async () => {
      m.usuarios.buscarPorId.mockResolvedValue(null);

      expect(await statusDe(m.service.crear(ALTA as never))).toBe(404);
      expect(m.socios.crear).not.toHaveBeenCalled();
    });

    it('409 si el usuario ya es socio, sin crear nada', async () => {
      m.usuarios.buscarPorId.mockResolvedValue({ id: 50, rol: 'SOCIO' });

      expect(await statusDe(m.service.crear(ALTA as never))).toBe(409);
      expect(m.socios.crear).not.toHaveBeenCalled();
      expect(m.eventos.emitAsync).not.toHaveBeenCalled();
    });

    it('si la pasarela rechaza el cobro (402), compensa con la baja logica y propaga el error', async () => {
      m.eventos.emitAsync.mockRejectedValue(new ProblemException({ type: 'pago', title: 'Pago rechazado', status: 402 }));

      expect(await statusDe(m.service.crear(ALTA as never))).toBe(402);
      expect(m.socios.marcarBaja).toHaveBeenCalledWith(12);
    });

    it('si no se encuentra la membresia recien creada, tambien compensa', async () => {
      m.membresias.obtenerPorSocioId.mockRejectedValue(new ProblemException({ type: 'x', title: 'Sin membresia', status: 404 }));

      expect(await statusDe(m.service.crear(ALTA as never))).toBe(404);
      expect(m.eventos.emitAsync).not.toHaveBeenCalled();
      expect(m.socios.marcarBaja).toHaveBeenCalledWith(12);
    });
  });

  describe('modificar y baja', () => {
    it('cambia la sede de origen', async () => {
      m.socios.actualizar.mockResolvedValue({ ...SOCIO, sedeOrigenId: 2 });

      expect(await m.service.modificar(12, { sedeOrigenId: 2 } as never)).toMatchObject({ sedeOrigenId: 2 });
      expect(m.socios.actualizar).toHaveBeenCalledWith(12, { sedeOrigenId: 2 });
    });

    it('422 si el PATCH viene vacio, sin tocar la base', async () => {
      expect(await statusDe(m.service.modificar(12, {} as never))).toBe(422);
      expect(m.socios.actualizar).not.toHaveBeenCalled();
    });

    it('404 si el socio a modificar no existe', async () => {
      m.socios.actualizar.mockResolvedValue(null);
      expect(await statusDe(m.service.modificar(12, { sedeOrigenId: 2 } as never))).toBe(404);
    });

    it('dejarDeSerSocio hace la baja logica', async () => {
      await m.service.dejarDeSerSocio(12);
      expect(m.socios.marcarBaja).toHaveBeenCalledWith(12);
    });

    it('dejarDeSerSocio de un socio inexistente da 404 sin tocar nada', async () => {
      m.socios.buscarPorId.mockResolvedValue(null);

      expect(await statusDe(m.service.dejarDeSerSocio(12))).toBe(404);
      expect(m.socios.marcarBaja).not.toHaveBeenCalled();
    });
  });

  describe('consultas', () => {
    it('listar pasa los filtros y la paginacion por defecto 1/20', async () => {
      const res = await m.service.listar({ sedeOrigenId: 1, estadoMembresia: 'VENCIDA', plan: 'MENSUAL', nombre: 'ana' } as never);

      expect(m.socios.listar).toHaveBeenCalledWith(
        { sedeOrigenId: 1, estadoMembresia: 'VENCIDA', plan: 'MENSUAL', nombre: 'ana' },
        { page: 1, perPage: 20 },
      );
      expect(res.total).toBe(1);
    });

    it('obtenerPorId devuelve el socio o 404', async () => {
      m.socios.buscarPorId.mockResolvedValueOnce(SOCIO).mockResolvedValueOnce(null);

      expect(await m.service.obtenerPorId(12)).toMatchObject({ id: 12 });
      expect(await statusDe(m.service.obtenerPorId(12))).toBe(404);
    });
  });

  describe('lo que consumen otros modulos', () => {
    it('obtenerEmail: el del socio, o null si no existe (observer de M3)', async () => {
      m.socios.buscarPorId.mockResolvedValueOnce(SOCIO).mockResolvedValueOnce(null);

      expect(await m.service.obtenerEmail(12)).toBe('ana@fitzone.test');
      expect(await m.service.obtenerEmail(99)).toBeNull();
    });

    it('obtenerSocioIdPorUsuario y obtenerUsuarioIdPorSocio resuelven en los dos sentidos (login y penalidad)', async () => {
      expect(await m.service.obtenerSocioIdPorUsuario(50)).toBe(12);
      expect(await m.service.obtenerUsuarioIdPorSocio(12)).toBe(50);

      m.socios.buscarPorUsuarioId.mockResolvedValue(null);
      m.socios.buscarPorId.mockResolvedValue(null);
      expect(await m.service.obtenerSocioIdPorUsuario(50)).toBeNull();
      expect(await m.service.obtenerUsuarioIdPorSocio(12)).toBeNull();
    });

    it('TOTP: lee el estado por usuario o por socio y guarda el secreto cifrado (RF-04)', async () => {
      const estado = { totpSecreto: 'iv:tag:dato', qrActivo: true };
      m.socios.buscarTotpPorUsuarioId.mockResolvedValue(estado);
      m.socios.buscarTotpPorSocioId.mockResolvedValue(estado);

      expect(await m.service.obtenerEstadoTotp(50)).toBe(estado);
      expect(await m.service.obtenerEstadoTotpPorSocio(12)).toBe(estado);
      await m.service.activarTotp(50, 'iv:tag:nuevo');
      expect(m.socios.guardarTotpSecreto).toHaveBeenCalledWith(50, 'iv:tag:nuevo');
    });
  });
});
