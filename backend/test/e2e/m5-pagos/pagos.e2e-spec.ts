import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp } from '@test/helpers/base-de-datos';
import { crearContextoM5 } from './m5.fixtures';

// E2E de /pagos: solo el contrato HTTP que la integración no puede ver (cabecera
// Idempotency-Key en el controller, Location del 201, problem+json del 409/400 y el
// @unique de la base). El cobro, la anulación y el comprobante viven en la integración.
describe('M5 - Pagos: contrato HTTP (RF-13)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof crearContextoM5>>;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    ctx = await crearContextoM5(app, prisma);
  });

  afterAll(async () => {
    await ctx.limpiar();
    await app.close();
  });

  it('cobra una reserva y responde 201 + Location', async () => {
    const reservaId = await ctx.crearReserva(7750);

    const res = await ctx.cobroReserva(reservaId, `happy-${ctx.sufijo}`).expect(201);

    expect(res.headers.location).toMatch(/^\/api\/v1\/pagos\/\d+$/);
    expect(res.body).toMatchObject({ usuarioId: ctx.usuarioId, monto: 7750, estado: 'APROBADO' });
  });

  it('no devuelve el token ni la clave de idempotencia (RNF-02)', async () => {
    const reservaId = await ctx.crearReserva();

    const res = await ctx.cobroReserva(reservaId, `rnf-${ctx.sufijo}`).expect(201);

    expect(res.body).not.toHaveProperty('token');
    expect(res.body).not.toHaveProperty('idempotenciaKey');
  });

  it('409 con la misma clave: el @unique corta el reintento y deja un solo pago', async () => {
    const reservaId = await ctx.crearReserva();
    const clave = `dup-${ctx.sufijo}`;

    await ctx.cobroReserva(reservaId, clave).expect(201);

    const repetido = await ctx.cobroReserva(reservaId, clave).expect(409);

    expect(repetido.headers['content-type']).toContain('application/problem+json');
    expect(repetido.body).toMatchObject({
      type: 'https://fitzone.app/errores/idempotencia-repetida',
      status: 409,
    });
    expect(await prisma.pago.count({ where: { idempotencia_key: clave } })).toBe(1);
  });

  it('400 si falta la cabecera Idempotency-Key, sin insertar nada', async () => {
    const antes = await prisma.pago.count();

    const res = await request(app.getHttpServer())
      .post('/api/v1/pagos')
      .send({ concepto: { tipo: 'MEMBRESIA', membresiaId: ctx.membresiaId }, token: 'tok_aprobado_1' })
      .expect(400);

    expect(res.body).toMatchObject({ title: 'Falta Idempotency-Key', status: 400 });
    expect(await prisma.pago.count()).toBe(antes);
  });

  it('GET /pagos?estado=TODOS incluye los no aprobados; sin estado sigue devolviendo solo los aprobados', async () => {
    const aprobado = await ctx.cobroReserva(await ctx.crearReserva(), `lista-ok-${ctx.sufijo}`).expect(201);
    // El rechazo responde 402 pero deja el pago persistido como RECHAZADO.
    await ctx.cobroReserva(await ctx.crearReserva(), `lista-no-${ctx.sufijo}`, 'tok_rechazado').expect(402);
    const filaRechazada = await prisma.pago.findUniqueOrThrow({ where: { idempotencia_key: `lista-no-${ctx.sufijo}` } });
    expect(filaRechazada.estado).toBe('RECHAZADO');

    const consulta = (estado?: string) =>
      request(app.getHttpServer())
        .get('/api/v1/pagos')
        .query({ usuarioId: ctx.usuarioId, perPage: 100, ...(estado ? { estado } : {}) })
        .expect(200);

    const todos = await consulta('TODOS');
    const idsTodos = todos.body.items.map((p: { id: number }) => p.id);
    expect(idsTodos).toEqual(expect.arrayContaining([aprobado.body.id, filaRechazada.id]));
    expect(todos.body.items.some((p: { estado: string }) => p.estado !== 'APROBADO')).toBe(true);

    const porDefecto = await consulta();
    const idsPorDefecto = porDefecto.body.items.map((p: { id: number }) => p.id);
    expect(idsPorDefecto).toContain(aprobado.body.id);
    expect(idsPorDefecto).not.toContain(filaRechazada.id);
    expect(porDefecto.body.items.every((p: { estado: string }) => p.estado === 'APROBADO')).toBe(true);
  });

  it('GET /pagos con un estado fuera del enum sigue siendo 422', async () => {
    await request(app.getHttpServer()).get('/api/v1/pagos').query({ estado: 'COBRADO' }).expect(422);
  });

  it('anula un pago APROBADO con 204 sin cuerpo', async () => {
    const reservaId = await ctx.crearReserva();
    const cobrado = await ctx.cobroReserva(reservaId, `anular-${ctx.sufijo}`).expect(201);

    const res = await request(app.getHttpServer()).post(`/api/v1/pagos/${cobrado.body.id}/anulaciones`).expect(204);

    expect(res.body).toEqual({});
    const pago = await prisma.pago.findUniqueOrThrow({ where: { id: cobrado.body.id } });
    expect(pago.estado).toBe('ANULADO');
  });
});
