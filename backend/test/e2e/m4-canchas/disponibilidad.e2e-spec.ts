import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp } from '@test/helpers/base-de-datos';
import { crearContextoM4 } from './m4.fixtures';

// E2E de la grilla de disponibilidad (RF-12/RNF-03): es una consulta HTTP que la
// integración no cubre, así que se conserva el comportamiento central (libre/ocupado
// y el efecto de EN_MANTENIMIENTO).
describe('M4 - Disponibilidad de cancha (RF-12/RNF-03)', () => {
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

  it('marca libre el tramo de una reserva cancelada y ocupado el de una vigente', async () => {
    const usuario = await ctx.crearExterno('Grilla E2E M4');

    const creada = await request(app.getHttpServer())
      .post('/api/v1/reservas-canchas')
      .send({
        canchaId: ctx.canchaId,
        usuarioId: usuario,
        fechaHoraInicio: ctx.inicio('17:00'),
        fechaHoraFin: ctx.fin('18:00'),
      })
      .expect(201);

    // 17:00 de la sede es 20:00Z.
    const tramo = (cuerpo: Array<{ fechaHoraInicio: string; disponible: boolean }>) =>
      cuerpo.find((e) => new Date(e.fechaHoraInicio).toISOString() === '2026-11-12T20:00:00.000Z');

    const conOcupada = await request(app.getHttpServer())
      .get(`/api/v1/canchas/${ctx.canchaId}/disponibilidad?fecha=${ctx.DIA}&perPage=100`)
      .expect(200);
    expect(tramo(conOcupada.body)?.disponible).toBe(false);

    await request(app.getHttpServer())
      .post(`/api/v1/reservas-canchas/${creada.body.id}/cancelaciones`)
      .expect(204);

    const conLibre = await request(app.getHttpServer())
      .get(`/api/v1/canchas/${ctx.canchaId}/disponibilidad?fecha=${ctx.DIA}&perPage=100`)
      .expect(200);
    expect(tramo(conLibre.body)?.disponible).toBe(true);
  });

  it('una cancha en mantenimiento devuelve todos los tramos ocupados sin tocar sus reservas (RF-12)', async () => {
    const conReserva = await prisma.cancha.create({
      data: { sede_id: ctx.sedeId, tipo: 'PADDLE', costo_por_hora: 3000, estado: 'OPERATIVA' },
    });
    ctx.canchasCreadas.push(conReserva.id);

    const usuario = await ctx.crearExterno('Inhabilitada E2E M4');

    const reserva = await request(app.getHttpServer())
      .post('/api/v1/reservas-canchas')
      .send({
        canchaId: conReserva.id,
        usuarioId: usuario,
        fechaHoraInicio: ctx.inicio('11:00'),
        fechaHoraFin: ctx.fin('12:00'),
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/canchas/${conReserva.id}`)
      .send({ estado: 'EN_MANTENIMIENTO' })
      .expect(200);

    const grilla = await request(app.getHttpServer())
      .get(`/api/v1/canchas/${conReserva.id}/disponibilidad?fecha=${ctx.DIA}&perPage=100`)
      .expect(200);
    expect(grilla.body.every((e: { disponible: boolean }) => e.disponible === false)).toBe(true);

    // Ponerla en mantenimiento no borra lo ya reservado (RF-12).
    const sigue = await request(app.getHttpServer())
      .get(`/api/v1/reservas-canchas/${reserva.body.id}`)
      .expect(200);
    expect(sigue.body.estado).toBe('CONFIRMADA');
  });
});
