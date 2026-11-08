import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemException } from '../../../commons/filters/problem.exception';
import type { TotpService } from '../../auth/services/totp.service';
import type { MembresiasService } from '../../m1-usuarios/services/membresias.service';
import type { Ingreso } from '../entities/ingreso.entity';
import type { IngresoRepository } from '../repositories/ingreso.repository';
import type { SedeRepository } from '../repositories/sede.repository';
import { IngresosService } from './ingresos.service';

// Unitario de M2: las reglas de acceso a la sede con los repositorios, la vigencia (M1) y el TOTP mockeados. La garantia
// de RN-01 contra la base (indice parcial unico) esta en ingresos.service.integration-spec.ts.
const SEDE = { id: 1, nombre: 'Centro', direccion: 'Calle 1', aforoMaximo: 50 };

function ingreso(parcial: Partial<Ingreso> = {}): Ingreso {
  return {
    id: 100,
    sedeId: SEDE.id,
    socioId: 7,
    nombre: 'Ana Socia',
    dni: '30111222',
    fechaHoraIngreso: new Date('2026-11-08T10:00:00Z'),
    fechaHoraEgreso: null,
    validadoOffline: false,
    ...parcial,
  };
}

function armar() {
  const ingresos = {
    crear: vi.fn(),
    buscarActivoPorSocio: vi.fn().mockResolvedValue(null),
    buscarPorId: vi.fn(),
    marcarEgreso: vi.fn().mockResolvedValue(undefined),
    contarActivosPorSede: vi.fn(),
    listar: vi.fn(),
  };
  const sedes = { buscarPorId: vi.fn().mockResolvedValue(SEDE) };
  const membresias = { consultarVigenciaPorSocio: vi.fn().mockResolvedValue({ esSocio: true, vigente: true, enMora: false }) };
  const totp = { validarIngreso: vi.fn().mockResolvedValue(undefined) };
  const service = new IngresosService(
    ingresos as unknown as IngresoRepository,
    sedes as unknown as SedeRepository,
    membresias as unknown as MembresiasService,
    totp as unknown as TotpService,
  );
  return { service, ingresos, sedes, membresias, totp };
}

async function problemaDe(promesa: Promise<unknown>): Promise<{ status: number; type: string }> {
  try {
    await promesa;
  } catch (error) {
    expect(error).toBeInstanceOf(ProblemException);
    const problema = error as ProblemException;
    return { status: problema.getStatus(), type: (problema.getResponse() as { type: string }).type };
  }
  throw new Error('se esperaba un error de dominio');
}

const DTO = { sedeId: SEDE.id, socioId: 7, codigoTotp: '123456' };

describe('IngresosService', () => {
  let m: ReturnType<typeof armar>;

  beforeEach(() => {
    m = armar();
  });

  describe('registrarIngreso (RF-04)', () => {
    it('registra el ingreso de un socio vigente y devuelve el ingreso creado', async () => {
      m.ingresos.crear.mockResolvedValue({ ok: true, ingreso: ingreso() });

      const res = await m.service.registrarIngreso(DTO as never);

      expect(res).toMatchObject({ id: 100, sedeId: SEDE.id, socioId: 7, fechaHoraEgreso: null });
      expect(m.totp.validarIngreso).toHaveBeenCalledWith(7, '123456');
      expect(m.ingresos.crear).toHaveBeenCalledWith({
        sedeId: SEDE.id,
        socioId: 7,
        fechaHoraIngreso: undefined,
        validadoOffline: false,
      });
    });

    it('respeta la fecha y la marca offline que manda el puesto', async () => {
      m.ingresos.crear.mockResolvedValue({ ok: true, ingreso: ingreso({ validadoOffline: true }) });

      await m.service.registrarIngreso({ ...DTO, fechaHoraIngreso: '2026-11-08T09:30:00Z', validadoOffline: true } as never);

      expect(m.ingresos.crear).toHaveBeenCalledWith(
        expect.objectContaining({ fechaHoraIngreso: new Date('2026-11-08T09:30:00Z'), validadoOffline: true }),
      );
    });

    it('404 si la sede no existe, sin consultar la membresia', async () => {
      m.sedes.buscarPorId.mockResolvedValue(null);

      expect((await problemaDe(m.service.registrarIngreso(DTO as never))).status).toBe(404);
      expect(m.membresias.consultarVigenciaPorSocio).not.toHaveBeenCalled();
    });

    it('403 membresia-inactiva si el socio no esta vigente, sin validar el QR ni insertar', async () => {
      m.membresias.consultarVigenciaPorSocio.mockResolvedValue({ esSocio: true, vigente: false, enMora: true });

      const problema = await problemaDe(m.service.registrarIngreso(DTO as never));

      expect(problema).toEqual({ status: 403, type: 'https://fitzone.app/errores/membresia-inactiva' });
      expect(m.totp.validarIngreso).not.toHaveBeenCalled();
      expect(m.ingresos.crear).not.toHaveBeenCalled();
    });

    it('si el codigo TOTP no valida, el error sube y no se inserta nada', async () => {
      m.totp.validarIngreso.mockRejectedValue(new ProblemException({ type: 'totp', title: 'TOTP', status: 403 }));

      expect((await problemaDe(m.service.registrarIngreso(DTO as never))).status).toBe(403);
      expect(m.ingresos.crear).not.toHaveBeenCalled();
    });

    it('409 aforo-lleno cuando la sede esta al tope', async () => {
      m.ingresos.crear.mockResolvedValue({ ok: false, motivo: 'AFORO_LLENO' });

      expect(await problemaDe(m.service.registrarIngreso(DTO as never))).toEqual({
        status: 409,
        type: 'https://fitzone.app/errores/aforo-lleno',
      });
    });
  });

  describe('RN-01: un socio no puede estar en dos sedes a la vez', () => {
    it('409 acceso-duplicado si el chequeo previo ya lo encuentra adentro (en cualquier sede)', async () => {
      m.ingresos.buscarActivoPorSocio.mockResolvedValue(ingreso({ sedeId: 2 }));

      expect(await problemaDe(m.service.registrarIngreso(DTO as never))).toEqual({
        status: 409,
        type: 'https://fitzone.app/errores/acceso-duplicado',
      });
      expect(m.ingresos.crear).not.toHaveBeenCalled();
    });

    it('409 acceso-duplicado tambien cuando lo ataja el indice unico de la base (carrera)', async () => {
      // Los dos accesos pasaron el chequeo previo; el INSERT del segundo vuelve con ACCESO_DUPLICADO.
      m.ingresos.crear.mockResolvedValue({ ok: false, motivo: 'ACCESO_DUPLICADO' });

      expect((await problemaDe(m.service.registrarIngreso(DTO as never))).type).toBe(
        'https://fitzone.app/errores/acceso-duplicado',
      );
    });
  });

  describe('registrarEgreso (RF-05)', () => {
    it('marca el egreso de un ingreso abierto', async () => {
      m.ingresos.buscarPorId.mockResolvedValue(ingreso());

      await m.service.registrarEgreso(100, { rol: 'GERENTE' });

      expect(m.ingresos.marcarEgreso).toHaveBeenCalledWith(100, expect.any(Date));
    });

    it('RECEPCION egresa en su propia sede', async () => {
      m.ingresos.buscarPorId.mockResolvedValue(ingreso());

      await m.service.registrarEgreso(100, { rol: 'RECEPCION', sedeId: SEDE.id });

      expect(m.ingresos.marcarEgreso).toHaveBeenCalled();
    });

    it('404 si el ingreso no existe', async () => {
      m.ingresos.buscarPorId.mockResolvedValue(null);
      expect((await problemaDe(m.service.registrarEgreso(1, { rol: 'GERENTE' }))).status).toBe(404);
    });

    it('403 si RECEPCION intenta egresar en otra sede, antes de revelar si ya tenia egreso', async () => {
      m.ingresos.buscarPorId.mockResolvedValue(ingreso({ sedeId: 2, fechaHoraEgreso: new Date() }));

      expect(await problemaDe(m.service.registrarEgreso(100, { rol: 'RECEPCION', sedeId: SEDE.id }))).toEqual({
        status: 403,
        type: 'https://fitzone.app/errores/egreso-fuera-de-sede',
      });
      expect(m.ingresos.marcarEgreso).not.toHaveBeenCalled();
    });

    it('409 egreso-duplicado si ya tenia egreso', async () => {
      m.ingresos.buscarPorId.mockResolvedValue(ingreso({ fechaHoraEgreso: new Date() }));

      expect((await problemaDe(m.service.registrarEgreso(100, { rol: 'GERENTE' }))).type).toBe(
        'https://fitzone.app/errores/egreso-duplicado',
      );
      expect(m.ingresos.marcarEgreso).not.toHaveBeenCalled();
    });
  });

  describe('obtenerAforo (RF-05)', () => {
    it('informa ocupacion, maximo y lugares restantes', async () => {
      m.ingresos.contarActivosPorSede.mockResolvedValue(48);

      expect(await m.service.obtenerAforo(SEDE.id)).toMatchObject({ aforoActual: 48, aforoMaximo: 50, restante: 2 });
    });

    it('404 si la sede no existe', async () => {
      m.sedes.buscarPorId.mockResolvedValue(null);
      expect((await problemaDe(m.service.obtenerAforo(9))).status).toBe(404);
    });
  });

  describe('listar y obtenerIngreso', () => {
    it('RECEPCION solo ve su sede: se fuerza el sedeId del token aunque pida otra', async () => {
      m.ingresos.listar.mockResolvedValue({ items: [ingreso()], total: 1 });

      const res = await m.service.listar({ sedeId: 99 } as never, { page: 1, perPage: 10 } as never, {
        rol: 'RECEPCION',
        sedeId: SEDE.id,
      });

      expect(m.ingresos.listar).toHaveBeenCalledWith({ sedeId: SEDE.id }, { page: 1, perPage: 10 });
      expect(res.total).toBe(1);
      expect(res.items[0]).toMatchObject({ id: 100 });
    });

    it('GERENTE usa el filtro tal cual', async () => {
      m.ingresos.listar.mockResolvedValue({ items: [], total: 0 });

      await m.service.listar({ sedeId: 99 } as never, { page: 1, perPage: 10 } as never, { rol: 'GERENTE' });

      expect(m.ingresos.listar).toHaveBeenCalledWith({ sedeId: 99 }, { page: 1, perPage: 10 });
    });

    it('obtenerIngreso devuelve el ingreso o 404', async () => {
      m.ingresos.buscarPorId.mockResolvedValueOnce(ingreso()).mockResolvedValueOnce(null);

      expect(await m.service.obtenerIngreso(100)).toMatchObject({ id: 100 });
      expect((await problemaDe(m.service.obtenerIngreso(100))).status).toBe(404);
    });
  });

  describe('sincronizar (RNF-01, lote offline)', () => {
    it('procesa cada item por separado: un rechazo no corta el lote', async () => {
      m.membresias.consultarVigenciaPorSocio.mockImplementation(async (socioId: number) => ({
        esSocio: true,
        vigente: socioId !== 2,
        enMora: socioId === 2,
      }));
      m.ingresos.buscarActivoPorSocio.mockImplementation(async (socioId: number) =>
        socioId === 3 ? ingreso({ socioId: 3, sedeId: 5 }) : null,
      );
      m.ingresos.crear.mockImplementation(async ({ socioId }: { socioId: number }) =>
        socioId === 4 ? { ok: false, motivo: 'AFORO_LLENO' } : { ok: true, ingreso: ingreso({ id: 500 + socioId, socioId }) },
      );
      const fecha = '2026-11-08T08:00:00Z';

      const res = await m.service.sincronizar(
        {
          ingresos: [
            { localId: 1, socioId: 1, fechaHoraIngreso: fecha },
            { localId: 2, socioId: 2, fechaHoraIngreso: fecha },
            { localId: 3, socioId: 3, fechaHoraIngreso: fecha },
            { localId: 4, socioId: 4, fechaHoraIngreso: fecha },
          ],
        } as never,
        SEDE.id,
      );

      expect(res.resultados).toEqual([
        expect.objectContaining({ localId: 1, ok: true, serverId: 501 }),
        expect.objectContaining({ localId: 2, ok: false, error: 'USUARIO_BLOQUEADO' }),
        expect.objectContaining({ localId: 3, ok: false, error: 'YA_DENTRO' }),
        expect.objectContaining({ localId: 4, ok: false, error: 'AFORO_LLENO' }),
      ]);
      // Todo lo sincronizado queda marcado como validado offline y en la sede del puesto.
      expect(m.ingresos.crear).toHaveBeenCalledWith(
        expect.objectContaining({ sedeId: SEDE.id, validadoOffline: true, fechaHoraIngreso: new Date(fecha) }),
      );
    });

    it('el indice unico tambien se reporta como YA_DENTRO en el lote', async () => {
      m.ingresos.crear.mockResolvedValue({ ok: false, motivo: 'ACCESO_DUPLICADO' });

      const res = await m.service.sincronizar(
        { ingresos: [{ localId: 1, socioId: 1, fechaHoraIngreso: '2026-11-08T08:00:00Z' }] } as never,
        SEDE.id,
      );

      expect(res.resultados[0]).toMatchObject({ ok: false, error: 'YA_DENTRO' });
    });

    it('resuelve los egresos contra los ingresos del mismo lote', async () => {
      m.ingresos.crear.mockResolvedValue({ ok: true, ingreso: ingreso({ id: 900 }) });
      m.ingresos.buscarPorId.mockResolvedValue(ingreso({ id: 900 }));

      const res = await m.service.sincronizar(
        {
          ingresos: [{ localId: 1, socioId: 7, fechaHoraIngreso: '2026-11-08T08:00:00Z' }],
          egresos: [
            { localId: 10, ingresoLocalId: 1, fechaHoraEgreso: '2026-11-08T09:00:00Z' },
            { localId: 11, ingresoLocalId: 99, fechaHoraEgreso: '2026-11-08T09:00:00Z' },
          ],
        } as never,
        SEDE.id,
      );

      expect(m.ingresos.marcarEgreso).toHaveBeenCalledWith(900, new Date('2026-11-08T09:00:00Z'));
      expect(res.egresosProcesados).toEqual([
        expect.objectContaining({ localId: 10, ok: true }),
        expect.objectContaining({ localId: 11, ok: false, error: 'INGRESO_NO_ENCONTRADO' }),
      ]);
    });

    it('reporta egreso duplicado o ingreso borrado sin romper', async () => {
      m.ingresos.crear
        .mockResolvedValueOnce({ ok: true, ingreso: ingreso({ id: 1 }) })
        .mockResolvedValueOnce({ ok: true, ingreso: ingreso({ id: 2 }) });
      m.ingresos.buscarPorId.mockImplementation(async (id: number) =>
        id === 1 ? ingreso({ id: 1, fechaHoraEgreso: new Date() }) : null,
      );
      const fecha = '2026-11-08T08:00:00Z';

      const res = await m.service.sincronizar(
        {
          ingresos: [
            { localId: 1, socioId: 7, fechaHoraIngreso: fecha },
            { localId: 2, socioId: 8, fechaHoraIngreso: fecha },
          ],
          egresos: [
            { localId: 10, ingresoLocalId: 1, fechaHoraEgreso: fecha },
            { localId: 11, ingresoLocalId: 2, fechaHoraEgreso: fecha },
          ],
        } as never,
        SEDE.id,
      );

      expect(res.egresosProcesados).toEqual([
        expect.objectContaining({ localId: 10, ok: false, error: 'EGRESO_DUPLICADO' }),
        expect.objectContaining({ localId: 11, ok: false, error: 'INGRESO_NO_ENCONTRADO' }),
      ]);
      expect(m.ingresos.marcarEgreso).not.toHaveBeenCalled();
    });
  });
});
