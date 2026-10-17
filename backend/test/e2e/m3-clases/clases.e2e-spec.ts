import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp } from '@test/helpers/base-de-datos';
import { crearContextoM3 } from './m3.fixtures';

// E2E de clases: el alta por HTTP (201 + Location) y su aparición en el listado. Las
// validaciones (sede 404, rango/pasado) viven en la integración.
describe('M3 - Clases: gestión de agenda (RF-06)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof crearContextoM3>>;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    ctx = await crearContextoM3(app, prisma);
  });

  afterAll(async () => {
    await ctx.limpiar();
    await app.close();
  });

  it('POST /clases crea una clase (201 + Location) y GET /clases la lista con cupo', async () => {
    const fechaClase = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const resCrear = await request(app.getHttpServer())
      .post('/api/v1/clases')
      .send({
        sedeId: ctx.sedeId,
        tipo: 'Spinning',
        instructor: 'Martín Palermo',
        horarioInicio: fechaClase,
        horarioFin: ctx.finDe(fechaClase),
        capacidad: 20,
      })
      .expect(201);

    const claseId: number = resCrear.body.id;
    ctx.clasesCreadas.push(claseId);

    expect(resCrear.headers.location).toBe(`/api/v1/clases/${claseId}`);
    expect(resCrear.body).toMatchObject({ cupoDisponible: 20, reservasConfirmadas: 0 });

    const resListar = await request(app.getHttpServer())
      .get(`/api/v1/clases?sedeId=${ctx.sedeId}&tipo=Spinning`)
      .expect(200);
    const claseEncontrada = resListar.body.items.find((c: { id: number }) => c.id === claseId);
    expect(claseEncontrada?.instructor).toBe('Martín Palermo');
    expect(resListar.body.total).toBeGreaterThanOrEqual(1);
  });
});
