import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from 'src/commons/database/prisma.service';
import { ProblemException } from 'src/commons/filters/problem.exception';
import { GimnasioModule } from 'src/modules/m2-gimnasio/gimnasio.module';
import { IngresosService } from 'src/modules/m2-gimnasio/services/ingresos.service';
import { SedesService } from 'src/modules/m2-gimnasio/services/sedes.service';
import { crearSede, crearSocioConMembresia } from '@test/helpers/base-de-datos';
import { crearModuloDeIntegracion } from '@test/helpers/modulo-de-integracion';

// Integration: bootea GimnasioModule (+ M1 y Auth por sus dependencias) contra la BD
// real. Cubre ingreso/aforo/egreso, las reglas de RN-01, aforo lleno y membresía no
// vigente, y el lote de sincronización offline (RNF-01).
describe('M2 IngresosService (integration, BD real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let ingresos: IngresosService;
  let sedes: SedesService;
  const sedesCreadas: number[] = [];
  const sociosCreados: number[] = [];
  const usuariosCreados: number[] = [];

  beforeAll(async () => {
    moduleRef = await crearModuloDeIntegracion(GimnasioModule);
    prisma = moduleRef.get(PrismaService);
    ingresos = moduleRef.get(IngresosService);
    sedes = moduleRef.get(SedesService);
  });

  afterAll(async () => {
    await prisma.ingreso.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.deleteMany({ where: { id: { in: sedesCreadas } } });
    await moduleRef.close();
  });

  async function nuevaSede(aforo: number): Promise<number> {
    const sede = await sedes.crear({ nombre: 'Sede E2E M2 int', direccion: 'Calle 1', aforoMaximo: aforo } as never);
    sedesCreadas.push(sede.id);
    return sede.id;
  }

  async function nuevoSocio(sedeId: number, vigente: boolean): Promise<number> {
    const { socioId, usuarioId } = await crearSocioConMembresia(prisma, { sedeId, vigente });
    sociosCreados.push(socioId);
    usuariosCreados.push(usuarioId);
    return socioId;
  }

  function registrar(sedeId: number, socioId: number) {
    return ingresos.registrarIngreso({ sedeId, socioId, codigoTotp: '123456' } as never);
  }

  it('flujo: ingreso -> aforo ocupado -> egreso -> aforo liberado', async () => {
    const sedeId = await nuevaSede(5);
    const socioId = await nuevoSocio(sedeId, true);

    const ingreso = await registrar(sedeId, socioId);
    expect(ingreso.fechaHoraEgreso).toBeNull();

    const ocupado = await ingresos.obtenerAforo(sedeId);
    expect(ocupado).toMatchObject({ aforoActual: 1, restante: 4 });

    await ingresos.registrarEgreso(ingreso.id, { rol: 'GERENTE' });

    const liberado = await ingresos.obtenerAforo(sedeId);
    expect(liberado).toMatchObject({ aforoActual: 0, restante: 5 });
  });

  it('RN-01: un segundo ingreso abierto del mismo socio → 409', async () => {
    const sedeId = await nuevaSede(5);
    const socioId = await nuevoSocio(sedeId, true);

    await registrar(sedeId, socioId);
    await expect(registrar(sedeId, socioId)).rejects.toBeInstanceOf(ProblemException);
  });

  it('aforo lleno → 409 cuando la sede llega a su capacidad', async () => {
    const sedeId = await nuevaSede(1);
    const socioA = await nuevoSocio(sedeId, true);
    const socioB = await nuevoSocio(sedeId, true);

    await registrar(sedeId, socioA);
    await expect(registrar(sedeId, socioB)).rejects.toBeInstanceOf(ProblemException);
  });

  it('403 si la membresía no está vigente', async () => {
    const sedeId = await nuevaSede(5);
    const socioId = await nuevoSocio(sedeId, false);

    await expect(registrar(sedeId, socioId)).rejects.toBeInstanceOf(ProblemException);
  });

  it('404 si la sede no existe', async () => {
    const socioId = await nuevoSocio(sedesCreadas[0] ?? (await nuevaSede(5)), true);

    await expect(registrar(99999999, socioId)).rejects.toBeInstanceOf(ProblemException);
  });

  it('RNF-01: el lote reporta bloqueado/ya-dentro sin romper y procesa el egreso del mismo lote', async () => {
    const sedeId = await nuevaSede(5);
    const enMora = await nuevoSocio(sedeId, false);
    const dentro = await nuevoSocio(sedeId, true);
    await registrar(sedeId, dentro);

    const lote = await ingresos.sincronizar(
      {
        ingresos: [
          { localId: 10, socioId: enMora, fechaHoraIngreso: new Date().toISOString() },
          { localId: 11, socioId: dentro, fechaHoraIngreso: new Date().toISOString() },
        ],
        egresos: [],
      } as never,
      sedeId,
    );

    const porLocal = new Map(lote.resultados.map((r) => [r.localId, r]));
    expect(porLocal.get(10)).toMatchObject({ ok: false, error: 'USUARIO_BLOQUEADO' });
    expect(porLocal.get(11)).toMatchObject({ ok: false, error: 'YA_DENTRO' });

    const sano = await nuevoSocio(sedeId, true);
    const conEgreso = await ingresos.sincronizar(
      {
        ingresos: [{ localId: 5, socioId: sano, fechaHoraIngreso: new Date().toISOString() }],
        egresos: [{ localId: 6, ingresoLocalId: 5, fechaHoraEgreso: new Date(Date.now() + 3_600_000).toISOString() }],
      } as never,
      sedeId,
    );
    expect(conEgreso.resultados[0]).toMatchObject({ localId: 5, ok: true });
    expect(conEgreso.egresosProcesados[0]).toMatchObject({ localId: 6, ok: true });
  });
});
