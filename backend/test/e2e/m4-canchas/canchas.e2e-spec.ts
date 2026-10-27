import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp } from '@test/helpers/base-de-datos';
import { crearContextoM4 } from './m4.fixtures';

// E2E de M4 canchas: solo lo que es HTTP/contrato y NO cubre la integración
// (201 + Location del alta, y el cruce RF-09 -> RF-12 del 409 de mantenimiento).
// El CRUD, listado por sede, paginación y validación viven en la integración y en los DTO.
// El listado de todas las sedes (GET /canchas) sí tiene su bloque acá: es la superficie
// HTTP nueva (query, 422 y ruta sin choque con /canchas/{id}).
describe('M4 - Canchas: alta y cruce con reservas (RF-09/RF-12)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof crearContextoM4>>;
  let sedeCanchasId: number;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    ctx = await crearContextoM4(app, prisma);

    const sede = await prisma.sede.create({
      data: { nombre: 'Sede E2E M4 canchas', direccion: 'Calle Sin Nombre 789', aforo_maximo: 30 },
    });
    sedeCanchasId = sede.id;
    ctx.sedesCreadas.push(sede.id);
  });

  afterAll(async () => {
    await ctx.limpiar();
    await app.close();
  });

  it('crea una cancha con 201, Location y estado OPERATIVA por defecto', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/sedes/${sedeCanchasId}/canchas`)
      .send({ tipo: 'PADDLE', costoPorHora: 7000 })
      .expect(201);
    ctx.canchasCreadas.push(res.body.id);

    expect(res.headers.location).toBe(`/api/v1/sedes/${sedeCanchasId}/canchas/${res.body.id}`);
    expect(res.body).toMatchObject({
      sedeId: sedeCanchasId,
      tipo: 'PADDLE',
      costoPorHora: 7000,
      estado: 'OPERATIVA',
    });
  });

  it('poner una cancha EN_MANTENIMIENTO hace fallar la reserva con 409 cancha-en-mantenimiento', async () => {
    const creada = await request(app.getHttpServer())
      .post(`/api/v1/sedes/${sedeCanchasId}/canchas`)
      .send({ tipo: 'PADDLE', costoPorHora: 5000 })
      .expect(201);
    ctx.canchasCreadas.push(creada.body.id);
    const externoId = await ctx.crearExterno();

    await request(app.getHttpServer())
      .patch(`/api/v1/canchas/${creada.body.id}`)
      .send({ estado: 'EN_MANTENIMIENTO' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/api/v1/reservas-canchas')
      .send({
        canchaId: creada.body.id,
        usuarioId: externoId,
        fechaHoraInicio: ctx.inicio('09:00'),
        fechaHoraFin: ctx.fin('10:00'),
      })
      .expect(409);

    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.type).toBe('https://fitzone.app/errores/cancha-en-mantenimiento');
    expect(res.body.detail).toContain('mantenimiento');
  });

  // GET /canchas (buscarCanchas): listado de todas las sedes. Las sedes y canchas se
  // crean directo con Prisma y se registran en el contexto, que las borra en limpiar().
  describe('GET /canchas: listado de todas las sedes', () => {
    let sedeA: number;
    let sedeB: number;
    // En orden de alta: A tiene 3 canchas, B tiene 2.
    let paddleOpA: number;
    let paddleMantA: number;
    let futbolOpA: number;
    let futbolOpB: number;
    let futbolMantB: number;

    async function crearCanchaDirecta(
      sede: number,
      tipo: 'PADDLE' | 'FUTBOL5',
      estado: 'OPERATIVA' | 'EN_MANTENIMIENTO',
    ): Promise<number> {
      const cancha = await prisma.cancha.create({ data: { sede_id: sede, tipo, costo_por_hora: 5000, estado } });
      ctx.canchasCreadas.push(cancha.id);
      return cancha.id;
    }

    async function crearSedeDirecta(nombre: string): Promise<number> {
      const sede = await prisma.sede.create({ data: { nombre, direccion: 'Calle Listado 1', aforo_maximo: 20 } });
      ctx.sedesCreadas.push(sede.id);
      return sede.id;
    }

    function buscar(query: Record<string, string | number> = {}) {
      return request(app.getHttpServer()).get('/api/v1/canchas').query(query);
    }

    const idsDe = (res: request.Response) => res.body.items.map((c: { id: number }) => c.id);

    beforeAll(async () => {
      sedeA = await crearSedeDirecta('Sede E2E M4 listado A');
      sedeB = await crearSedeDirecta('Sede E2E M4 listado B');
      paddleOpA = await crearCanchaDirecta(sedeA, 'PADDLE', 'OPERATIVA');
      paddleMantA = await crearCanchaDirecta(sedeA, 'PADDLE', 'EN_MANTENIMIENTO');
      futbolOpA = await crearCanchaDirecta(sedeA, 'FUTBOL5', 'OPERATIVA');
      futbolOpB = await crearCanchaDirecta(sedeB, 'FUTBOL5', 'OPERATIVA');
      futbolMantB = await crearCanchaDirecta(sedeB, 'FUTBOL5', 'EN_MANTENIMIENTO');
    });

    it('200 sin filtros: forma { items, total }, total real y orden por sede y luego por id', async () => {
      const res = await buscar({ perPage: 100 }).expect(200);

      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body.total).toBe(await prisma.cancha.count());
      expect(res.body.total).toBeGreaterThanOrEqual(6); // las 5 de este bloque + la base del contexto
      expect(res.body.items.length).toBeLessThanOrEqual(100);
      expect(res.body.items[0]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          sedeId: expect.any(Number),
          tipo: expect.stringMatching(/^(PADDLE|FUTBOL5)$/),
          costoPorHora: expect.any(Number),
          estado: expect.stringMatching(/^(OPERATIVA|EN_MANTENIMIENTO)$/),
        }),
      );

      const items: { id: number; sedeId: number }[] = res.body.items;
      for (let i = 1; i < items.length; i++) {
        const [previo, actual] = [items[i - 1], items[i]];
        expect(actual.sedeId > previo.sedeId || (actual.sedeId === previo.sedeId && actual.id > previo.id)).toBe(true);
      }
    });

    it('sin filtros usa los defaults de paginacion (pagina 1, 20 por pagina)', async () => {
      const res = await buscar().expect(200);

      expect(res.body.items.length).toBeLessThanOrEqual(20);
      expect(res.body.total).toBe(await prisma.cancha.count());
    });

    it('filtra por sedeId e incluye las en mantenimiento', async () => {
      const a = await buscar({ sedeId: sedeA }).expect(200);
      expect(idsDe(a)).toEqual([paddleOpA, paddleMantA, futbolOpA]);
      expect(a.body.total).toBe(3);
      expect(a.body.items.every((c: { sedeId: number }) => c.sedeId === sedeA)).toBe(true);

      const b = await buscar({ sedeId: sedeB }).expect(200);
      expect(idsDe(b)).toEqual([futbolOpB, futbolMantB]);
      expect(b.body.total).toBe(2);
    });

    it('filtra por tipo en todas las sedes', async () => {
      const res = await buscar({ tipo: 'PADDLE', perPage: 100 }).expect(200);

      expect(res.body.total).toBe(await prisma.cancha.count({ where: { tipo: 'PADDLE' } }));
      expect(res.body.items.every((c: { tipo: string }) => c.tipo === 'PADDLE')).toBe(true);
      expect(idsDe(res)).toEqual(expect.arrayContaining([paddleOpA, paddleMantA]));
      expect(idsDe(res)).not.toContain(futbolOpA);
    });

    it('filtra por estado en todas las sedes', async () => {
      const res = await buscar({ estado: 'EN_MANTENIMIENTO', perPage: 100 }).expect(200);

      expect(res.body.total).toBe(await prisma.cancha.count({ where: { estado: 'EN_MANTENIMIENTO' } }));
      expect(res.body.items.every((c: { estado: string }) => c.estado === 'EN_MANTENIMIENTO')).toBe(true);
      expect(idsDe(res)).toEqual(expect.arrayContaining([paddleMantA, futbolMantB]));
      expect(idsDe(res)).not.toContain(paddleOpA);
    });

    it('combina sedeId, tipo y estado', async () => {
      const soloUna = await buscar({ sedeId: sedeA, tipo: 'PADDLE', estado: 'EN_MANTENIMIENTO' }).expect(200);
      expect(idsDe(soloUna)).toEqual([paddleMantA]);
      expect(soloUna.body.total).toBe(1);

      const sedeYTipo = await buscar({ sedeId: sedeB, tipo: 'FUTBOL5' }).expect(200);
      expect(idsDe(sedeYTipo)).toEqual([futbolOpB, futbolMantB]);

      const sedeYEstado = await buscar({ sedeId: sedeA, estado: 'OPERATIVA' }).expect(200);
      expect(idsDe(sedeYEstado)).toEqual([paddleOpA, futbolOpA]);

      const tipoYEstado = await buscar({ tipo: 'FUTBOL5', estado: 'EN_MANTENIMIENTO', perPage: 100 }).expect(200);
      expect(idsDe(tipoYEstado)).toContain(futbolMantB);
      expect(idsDe(tipoYEstado)).not.toContain(futbolOpB);
    });

    it('una combinacion sin coincidencias responde 200 con lista vacia', async () => {
      const res = await buscar({ sedeId: sedeB, tipo: 'PADDLE' }).expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it('pagina con total constante y la ultima pagina incompleta', async () => {
      const p1 = await buscar({ sedeId: sedeA, page: 1, perPage: 2 }).expect(200);
      const p2 = await buscar({ sedeId: sedeA, page: 2, perPage: 2 }).expect(200);
      const p3 = await buscar({ sedeId: sedeA, page: 3, perPage: 2 }).expect(200);

      expect(idsDe(p1)).toEqual([paddleOpA, paddleMantA]);
      expect(idsDe(p2)).toEqual([futbolOpA]);
      expect(p3.body.items).toEqual([]);
      expect([p1.body.total, p2.body.total, p3.body.total]).toEqual([3, 3, 3]);
    });

    it('perPage=100 es el tope valido', async () => {
      const res = await buscar({ perPage: 100 }).expect(200);

      expect(res.body.items.length).toBeLessThanOrEqual(100);
    });

    it('422 problem+json por filtros o paginacion invalidos', async () => {
      const invalidas: Record<string, string | number>[] = [
        { sedeId: 0 },
        { sedeId: -1 },
        { sedeId: 'abc' },
        { sedeId: '1.5' },
        { tipo: 'TENIS' },
        { estado: 'ROTA' },
        { page: 0 },
        { perPage: 0 },
        { perPage: 101 },
        { parametroDesconocido: 'x' },
      ];

      for (const query of invalidas) {
        const res = await buscar(query).expect(422);
        expect(res.headers['content-type'], JSON.stringify(query)).toContain('application/problem+json');
      }
    });

    // Criterio: igual que GET /ingresos?sedeId y GET /socios?sedeOrigenId, un sedeId
    // inexistente no es 404 sino lista vacia.
    it('un sedeId inexistente responde 200 con lista vacia (no 404)', async () => {
      const res = await buscar({ sedeId: 2_000_000 }).expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    // No regresion de las rutas hermanas: el listado nuevo no pisa a /canchas/{id}
    // ni cambia GET /sedes/{sedeId}/canchas.
    it('GET /sedes/{sedeId}/canchas sigue igual: lista la sede, filtra por estado y da 404 si no existe', async () => {
      const todas = await request(app.getHttpServer()).get(`/api/v1/sedes/${sedeA}/canchas`).expect(200);
      expect(idsDe(todas)).toEqual([paddleOpA, paddleMantA, futbolOpA]);
      expect(todas.body.total).toBe(3);

      const operativas = await request(app.getHttpServer())
        .get(`/api/v1/sedes/${sedeA}/canchas`)
        .query({ estado: 'OPERATIVA' })
        .expect(200);
      expect(idsDe(operativas)).toEqual([paddleOpA, futbolOpA]);

      // El listado por sede no acepta los filtros nuevos: su lista blanca no cambio.
      await request(app.getHttpServer()).get(`/api/v1/sedes/${sedeA}/canchas`).query({ tipo: 'PADDLE' }).expect(422);
      await request(app.getHttpServer()).get(`/api/v1/sedes/${sedeA}/canchas`).query({ sedeId: sedeB }).expect(422);

      const inexistente = await request(app.getHttpServer()).get('/api/v1/sedes/2000000/canchas').expect(404);
      expect(inexistente.headers['content-type']).toContain('application/problem+json');
    });

    it('GET /canchas/{canchaId} sigue resolviendo a la cancha y no al listado', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/canchas/${futbolOpB}`).expect(200);

      expect(res.body).toMatchObject({ id: futbolOpB, sedeId: sedeB, tipo: 'FUTBOL5', estado: 'OPERATIVA' });
      expect(res.body.items).toBeUndefined();
    });
  });
});
