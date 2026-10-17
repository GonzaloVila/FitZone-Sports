import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProblemException } from 'src/commons/filters/problem.exception';
import { PrismaService } from 'src/commons/database/prisma.service';
import { CanchasModule } from 'src/modules/m4-canchas/canchas.module';
import { CanchasService } from 'src/modules/m4-canchas/services/canchas.service';
import { crearSede } from '@test/helpers/base-de-datos';
import { crearModuloDeIntegracion } from '@test/helpers/modulo-de-integracion';

// Integration: bootea solo CanchasModule (no el AppModule) contra la BD real y llama
// al SERVICE directo (sin HTTP). Cubre el CRUD de canchas, que en e2e sobraba.
describe('M4 CanchasService (integration, BD real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let canchas: CanchasService;
  let sedeId: number;
  const canchasCreadas: number[] = [];

  beforeAll(async () => {
    moduleRef = await crearModuloDeIntegracion(CanchasModule);
    prisma = moduleRef.get(PrismaService);
    canchas = moduleRef.get(CanchasService);
    sedeId = await crearSede(prisma);
  });

  afterAll(async () => {
    await prisma.cancha.deleteMany({ where: { id: { in: canchasCreadas } } });
    await prisma.sede.delete({ where: { id: sedeId } });
    await moduleRef.close();
  });

  async function crear(dto: { tipo: string; costoPorHora: number; estado?: string }) {
    const cancha = await canchas.crear(sedeId, dto as never);
    canchasCreadas.push(cancha.id);
    return cancha;
  }

  it('crea una cancha en OPERATIVA por defecto', async () => {
    const cancha = await crear({ tipo: 'PADDLE', costoPorHora: 7000 });

    expect(cancha.tipo).toBe('PADDLE');
    expect(cancha.costoPorHora).toBe(7000);
    expect(cancha.estado).toBe('OPERATIVA');
  });

  it('devuelve costo_por_hora como numero (no string de Decimal)', async () => {
    const cancha = await crear({ tipo: 'FUTBOL5', costoPorHora: 7250.5 });

    expect(typeof cancha.costoPorHora).toBe('number');
    expect(cancha.costoPorHora).toBeCloseTo(7250.5, 2);
  });

  it('lista por sede e incluye las canchas en mantenimiento; filtra por estado', async () => {
    await crear({ tipo: 'PADDLE', costoPorHora: 5000 });
    await crear({ tipo: 'PADDLE', costoPorHora: 5000, estado: 'EN_MANTENIMIENTO' });

    const todas = await canchas.listar(sedeId, { page: 1, perPage: 100 });
    expect(todas.items.length).toBeGreaterThanOrEqual(2);
    expect(todas.items.filter((c) => c.estado === 'EN_MANTENIMIENTO').length).toBeGreaterThan(0);
    expect(todas.total).toBeGreaterThanOrEqual(2);

    const operativas = await canchas.listar(sedeId, { estado: 'OPERATIVA', page: 1, perPage: 100 });
    expect(operativas.items.every((c) => c.estado === 'OPERATIVA')).toBe(true);
  });

  it('404 si la sede no existe', async () => {
    await expect(canchas.crear(99999999, { tipo: 'PADDLE', costoPorHora: 5000 } as never)).rejects.toBeInstanceOf(
      ProblemException,
    );
  });

  it('obtiene por id con todos los campos y 404 si no existe', async () => {
    const cancha = await crear({ tipo: 'FUTBOL5', costoPorHora: 6400 });

    const out = await canchas.obtener(cancha.id);
    expect(out).toMatchObject({ id: cancha.id, sedeId, tipo: 'FUTBOL5', costoPorHora: 6400, estado: 'OPERATIVA' });

    await expect(canchas.obtener(99999999)).rejects.toBeInstanceOf(ProblemException);
  });

  it('actualiza solo costo (deja estado) y solo estado (deja costo), y persiste', async () => {
    const cancha = await crear({ tipo: 'PADDLE', costoPorHora: 5000 });

    const soloCosto = await canchas.actualizar(cancha.id, { costoPorHora: 5500 } as never);
    expect(soloCosto.costoPorHora).toBe(5500);
    expect(soloCosto.estado).toBe('OPERATIVA');

    const soloEstado = await canchas.actualizar(cancha.id, { estado: 'EN_MANTENIMIENTO' } as never);
    expect(soloEstado.estado).toBe('EN_MANTENIMIENTO');
    expect(soloEstado.costoPorHora).toBe(5500);

    const persistida = await canchas.obtener(cancha.id);
    expect(persistida.costoPorHora).toBe(5500);
    expect(persistida.estado).toBe('EN_MANTENIMIENTO');
  });

  it('422 (canchaSinCamposParaModificar) con body vacio, sin tocar la fila', async () => {
    const cancha = await crear({ tipo: 'PADDLE', costoPorHora: 5000 });

    await expect(canchas.actualizar(cancha.id, {} as never)).rejects.toBeInstanceOf(ProblemException);

    const persistida = await canchas.obtener(cancha.id);
    expect(persistida.costoPorHora).toBe(5000);
    expect(persistida.estado).toBe('OPERATIVA');
  });
});
