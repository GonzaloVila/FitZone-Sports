import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp } from '@test/helpers/base-de-datos';
import { crearContextoM3 } from './m3.fixtures';

// E2E del desempate de la lista de espera: regresión de que la paginación no repite ni
// saltea filas cuando varias anotaciones empatan en el mismo milisegundo (orden total
// por id, no solo por fechaAnotacion). El resto de los listados/filtros no se cubre acá.
describe('M3 - Listados: desempate de paginación', () => {
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

  async function crearClase(tipo: string, horas: number, capacidad: number): Promise<number> {
    const fechaClase = new Date(Date.now() + horas * 3600 * 1000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/v1/clases')
      .send({
        sedeId: ctx.sedeId,
        tipo,
        instructor: 'Profe Listado',
        horarioInicio: fechaClase,
        horarioFin: ctx.finDe(fechaClase),
        capacidad,
      })
      .expect(201);
    ctx.clasesCreadas.push(res.body.id);
    return res.body.id;
  }

  it('GET /clases/{id}/espera pagina sin repetir ni saltear filas cuando empatan en fechaAnotacion', async () => {
    const claseId = await crearClase('Listado Espera Empate', 6, 1);

    const socioOcupante = await ctx.crearSocioConMembresia({ vigente: true });
    await request(app.getHttpServer())
      .post('/api/v1/reservas-clases')
      .send({ claseId, socioId: socioOcupante.socioId })
      .expect(201);

    const CANTIDAD = 4;
    for (let i = 0; i < CANTIDAD; i++) {
      const socio = await ctx.crearSocioConMembresia({ vigente: true });
      await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/espera`)
        .send({ socioId: socio.socioId })
        .expect(201);
    }

    // fechaAnotacion es TIMESTAMP(3): se fija la misma para forzar el empate.
    const empate = new Date('2026-01-02T03:04:05.678Z');
    await prisma.esperaClase.updateMany({ where: { clase_id: claseId }, data: { fecha_anotacion: empate } });

    const filas = await prisma.esperaClase.findMany({
      where: { clase_id: claseId },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    for (const fila of filas) {
      await prisma.esperaClase.update({ where: { id: fila.id }, data: { fecha_notificacion: new Date() } });
      await prisma.esperaClase.update({ where: { id: fila.id }, data: { fecha_notificacion: null } });
    }

    const pagina1 = await request(app.getHttpServer())
      .get(`/api/v1/clases/${claseId}/espera?perPage=2&page=1`)
      .expect(200);
    const pagina2 = await request(app.getHttpServer())
      .get(`/api/v1/clases/${claseId}/espera?perPage=2&page=2`)
      .expect(200);

    expect(pagina1.body.items).toHaveLength(2);
    expect(pagina2.body.items).toHaveLength(2);
    expect(pagina1.body.total).toBe(CANTIDAD);
    expect(pagina2.body.total).toBe(CANTIDAD);

    const ids = [...pagina1.body.items, ...pagina2.body.items].map((e: { id: number }) => e.id);
    expect(new Set(ids).size).toBe(CANTIDAD);
    expect(ids).toEqual([...ids].sort((a: number, b: number) => a - b));
  });
});
