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

  describe('GET /clases?estado=', () => {
    let conCupos: number;
    let comenzada: number;

    beforeAll(async () => {
      const nueva = async (inicioHoras: number) => {
        const clase = await prisma.clase.create({
          data: {
            sede_id: ctx.sedeId,
            tipo: 'Funcional',
            instructor: 'Lola',
            horario_inicio: new Date(Date.now() + inicioHoras * 3600 * 1000),
            horario_fin: new Date(Date.now() + (inicioHoras + 1) * 3600 * 1000),
            capacidad: 10,
          },
        });
        ctx.clasesCreadas.push(clase.id);
        return clase.id;
      };
      conCupos = await nueva(24);
      comenzada = await nueva(-1);
    });

    const idsDe = (items: { id: number }[]) => items.map((c) => c.id);

    it('200 con estado: devuelve solo las clases de ese estado, con su total', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/clases?sedeId=${ctx.sedeId}&tipo=Funcional&estado=CON_CUPOS`)
        .expect(200);

      expect(idsDe(res.body.items)).toEqual([conCupos]);
      expect(res.body.total).toBe(1);

      const resComenzadas = await request(app.getHttpServer())
        .get(`/api/v1/clases?sedeId=${ctx.sedeId}&tipo=Funcional&estado=COMENZADA`)
        .expect(200);
      expect(idsDe(resComenzadas.body.items)).toEqual([comenzada]);
    });

    it('200 sin estado: devuelve las clases en cualquier estado', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/clases?sedeId=${ctx.sedeId}&tipo=Funcional`)
        .expect(200);

      expect(idsDe(res.body.items).sort()).toEqual([conCupos, comenzada].sort());
      expect(res.body.total).toBe(2);
    });

    it('422 con un estado inválido', async () => {
      await request(app.getHttpServer()).get('/api/v1/clases?estado=CANCELADA').expect(422);
    });
  });
});
