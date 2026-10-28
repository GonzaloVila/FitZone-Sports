import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { penalidadCancelacionTardia } from 'src/modules/m3-clases/entities/reserva-clase.entity';
import { crearApp } from '@test/helpers/base-de-datos';
import { conToken, iniciarSesion } from '@test/helpers/sesion';
import { crearContextoM3 } from './m3.fixtures';

// E2E de reservas de clase: el contrato HTTP del alta y los DOS cruces con M5 (RF-07):
// la penalidad por cancelación tardía y el rechazo de la pasarela que deja la reserva
// CONFIRMADA. La ventana/duplicado/estado CUMPLIDA viven en la integración.
describe('M3 - Reservas de clase: alta y penalidad (RF-07)', () => {
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
        instructor: 'Profe',
        horarioInicio: fechaClase,
        horarioFin: ctx.finDe(fechaClase),
        capacidad,
      })
      .expect(201);
    ctx.clasesCreadas.push(res.body.id);
    return res.body.id;
  }

  it('reserva exitosa dentro de las 48 hs responde 201 + Location y decrementa el cupo', async () => {
    const { socioId } = await ctx.crearSocioConMembresia({ vigente: true });
    const claseId = await crearClase('CrossFit', 24, 10);

    const resReserva = await request(app.getHttpServer())
      .post('/api/v1/reservas-clases')
      .send({ claseId, socioId })
      .expect(201);

    expect(resReserva.headers.location).toBe(`/api/v1/reservas-clases/${resReserva.body.id}`);
    expect(resReserva.body.estado).toBe('CONFIRMADA');

    const resDetalle = await request(app.getHttpServer()).get(`/api/v1/clases/${claseId}`).expect(200);
    expect(resDetalle.body).toMatchObject({ reservasConfirmadas: 1, cupoDisponible: 9 });
  });

  it('cancelación con < 2 hs cobra la penalidad vía M5 y libera el cupo (RF-07)', async () => {
    const { socioId, usuarioId } = await ctx.crearSocioConMembresia({ vigente: true });
    const claseId = await crearClase('Spinning Exprés', 1, 5);

    const resReserva = await request(app.getHttpServer())
      .post('/api/v1/reservas-clases')
      .send({ claseId, socioId })
      .expect(201);
    const reservaId: number = resReserva.body.id;
    ctx.reservasClasesConPenalidad.push(reservaId);

    await request(app.getHttpServer())
      .post(`/api/v1/reservas-clases/${reservaId}/cancelaciones`)
      .expect(204);

    const pago = await prisma.pago.findFirst({ where: { pago_reserva_clase: { reserva_clase_id: reservaId } } });
    expect(pago).not.toBeNull();
    expect(pago!.estado).toBe('APROBADO');
    expect(pago!.monto.toNumber()).toBe(penalidadCancelacionTardia());
    expect(pago!.comprobantePdfUrl).not.toBeNull();
    ctx.pagosDePenalidad.push(pago!.id);

    // /pagos exige sesion. Como hace el frontend, el SOCIO busca su penalidad por reservaClaseId (el listado se acota solo a
    // su usuario) y baja el comprobante.
    const token = await iniciarSesion(app, prisma, usuarioId);
    const busqueda = await request(app.getHttpServer())
      .get('/api/v1/pagos')
      .set(conToken(token))
      .query({ reservaClaseId: reservaId, page: 1, perPage: 1 })
      .expect(200);
    expect(busqueda.body.items.map((p: { id: number }) => p.id)).toEqual([pago!.id]);
    const resComprobante = await request(app.getHttpServer())
      .get(`/api/v1/pagos/${pago!.id}/comprobante`)
      .set(conToken(token))
      .expect(200);
    expect((resComprobante.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('cancelación tardía rechazada por la pasarela: 402 y la reserva sigue CONFIRMADA (RF-07)', async () => {
    const { socioId } = await ctx.crearSocioConMembresia({ vigente: true });
    const claseId = await crearClase('Spinning Exprés', 1, 5);

    const resReserva = await request(app.getHttpServer())
      .post('/api/v1/reservas-clases')
      .send({ claseId, socioId })
      .expect(201);
    const reservaId: number = resReserva.body.id;

    // M3 emite el evento ANTES de marcar CANCELADA; si M5 rechaza (402), el error
    // se propaga y la cancelación no se aplica.
    process.env.PASARELA_MOCK = 'RECHAZADO';
    try {
      await request(app.getHttpServer())
        .post(`/api/v1/reservas-clases/${reservaId}/cancelaciones`)
        .expect(402);
    } finally {
      delete process.env.PASARELA_MOCK;
    }

    const resConsulta = await request(app.getHttpServer())
      .get(`/api/v1/reservas-clases/${reservaId}`)
      .expect(200);
    expect(resConsulta.body.estado).toBe('CONFIRMADA');

    const pago = await prisma.pago.findFirst({ where: { pago_reserva_clase: { reserva_clase_id: reservaId } } });
    expect(pago).toBeNull();
  });
});
