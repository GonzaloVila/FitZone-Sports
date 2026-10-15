import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp } from '@test/helpers/base-de-datos';
import { crearContextoM4 } from './m4.fixtures';

// E2E de M4 canchas: solo lo que es HTTP/contrato y NO cubre la integración
// (201 + Location del alta, y el cruce RF-09 -> RF-12 del 409 de mantenimiento).
// El CRUD, listado, paginación y validación viven en la integración y en los DTO.
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
});
