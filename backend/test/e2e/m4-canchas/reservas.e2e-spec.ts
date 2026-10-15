import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp } from '@test/helpers/base-de-datos';
import { crearContextoM4 } from './m4.fixtures';

// E2E de reservas de cancha: el contrato HTTP (201 + Location, 204 sin cuerpo) y la
// concurrencia real por HTTP. El pricing (RF-11/RN-03), la exclusión RN-02 y el State
// derivado CUMPLIDA viven en la integración, contra la misma constraint de la base.
describe('M4 - Reservas de cancha: alta, cancelación y concurrencia (RF-10/RF-12/RN-02)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof crearContextoM4>>;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    ctx = await crearContextoM4(app, prisma);
  });

  afterAll(async () => {
    await ctx.limpiar();
    await app.close();
  });

  it('crea una reserva de externo con 201, Location y estado CONFIRMADA', async () => {
    const externo = await ctx.crearExterno();

    const res = await request(app.getHttpServer())
      .post('/api/v1/reservas-canchas')
      .send({
        canchaId: ctx.canchaId,
        usuarioId: externo,
        fechaHoraInicio: ctx.inicio('10:00'),
        fechaHoraFin: ctx.fin('11:00'),
      })
      .expect(201);

    expect(res.headers.location).toBe(`/api/v1/reservas-canchas/${res.body.id}`);
    expect(res.body.estado).toBe('CONFIRMADA');
    expect(Number(res.body.precioAplicado)).toBeCloseTo(5000, 2);
  });

  it('cancela una CONFIRMADA con 204 sin cuerpo', async () => {
    const externa = await ctx.crearExterno('Cancelable E2E M4');

    const creada = await request(app.getHttpServer())
      .post('/api/v1/reservas-canchas')
      .send({
        canchaId: ctx.canchaId,
        usuarioId: externa,
        fechaHoraInicio: ctx.inicio('08:00'),
        fechaHoraFin: ctx.fin('09:00'),
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/reservas-canchas/${creada.body.id}/cancelaciones`)
      .expect(204);
    expect(res.body).toEqual({});

    const detalle = await request(app.getHttpServer())
      .get(`/api/v1/reservas-canchas/${creada.body.id}`)
      .expect(200);
    expect(detalle.body.estado).toBe('CANCELADA');
  });

  it('RN-02: dos reservas del mismo turno en paralelo por HTTP: una 201 y la otra 409', async () => {
    const dia = '2026-11-21';
    const cancha = await prisma.cancha.create({
      data: { sede_id: ctx.sedeId, tipo: 'FUTBOL5', costo_por_hora: 5000, estado: 'OPERATIVA' },
    });
    ctx.canchasCreadas.push(cancha.id);

    const usuarioA = await ctx.crearExterno('Concurrencia A');
    const usuarioB = await ctx.crearExterno('Concurrencia B');

    const cuerpo = (usuarioId: number) => ({
      canchaId: cancha.id,
      usuarioId,
      fechaHoraInicio: `${dia}T10:00:00-03:00`,
      fechaHoraFin: `${dia}T11:00:00-03:00`,
    });

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer()).post('/api/v1/reservas-canchas').send(cuerpo(usuarioA)),
      request(app.getHttpServer()).post('/api/v1/reservas-canchas').send(cuerpo(usuarioB)),
    ]);

    expect([resA.status, resB.status].sort()).toEqual([201, 409]);
    const perdedor = resA.status === 409 ? resA : resB;
    expect(perdedor.body.type).toContain('turno-ocupado');
  });
});
