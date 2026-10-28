import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp } from '@test/helpers/base-de-datos';
import { conToken } from '@test/helpers/sesion';
import { crearContextoM5 } from './m5.fixtures';

// E2E del acceso a /pagos: todo exige sesion, SOCIO y EXTERNO solo ven y cobran lo propio (lo ajeno es 404, como si no
// existiera), la anulacion es de RECEPCION y GERENTE, y el personal ve y cobra todo.
describe('M5 - Pagos: sesion y alcance por rol', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof crearContextoM5>>;

  // Un pago APROBADO de las reservas del SOCIO dueño del fixture.
  let pagoId: number;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    ctx = await crearContextoM5(app, prisma);
    const cobrado = await ctx.cobroReserva(await ctx.crearReserva(), `acceso-base-${ctx.sufijo}`).expect(201);
    pagoId = cobrado.body.id as number;
  });

  afterAll(async () => {
    await ctx.limpiar();
    await app.close();
  });

  describe('sin sesion', () => {
    it('los cinco endpoints responden 401 sin token', async () => {
      await http().post('/api/v1/pagos').set('Idempotency-Key', 'sin-token').send({}).expect(401);
      await http().get('/api/v1/pagos').expect(401);
      await http().get(`/api/v1/pagos/${pagoId}`).expect(401);
      await http().get(`/api/v1/pagos/${pagoId}/comprobante`).expect(401);
      await http().post(`/api/v1/pagos/${pagoId}/anulaciones`).expect(401);
    });

    it('un token inválido también es 401, y el pago no se toca', async () => {
      await http().get('/api/v1/pagos').set(conToken('token-falso')).expect(401);
      await http().post(`/api/v1/pagos/${pagoId}/anulaciones`).set(conToken('token-falso')).expect(401);

      const pago = await prisma.pago.findUniqueOrThrow({ where: { id: pagoId } });
      expect(pago.estado).toBe('APROBADO');
    });
  });

  describe('SOCIO y EXTERNO: solo lo propio', () => {
    it('el dueño ve su pago y descarga su comprobante', async () => {
      const visto = await http().get(`/api/v1/pagos/${pagoId}`).set(conToken(ctx.sesiones.socio)).expect(200);
      expect(visto.body).toMatchObject({ id: pagoId, usuarioId: ctx.usuarioId });

      const pdf = await http().get(`/api/v1/pagos/${pagoId}/comprobante`).set(conToken(ctx.sesiones.socio)).expect(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
    });

    it('la lista trae solo lo suyo: el usuarioId que mandan se ignora', async () => {
      const propio = await http()
        .get('/api/v1/pagos')
        .set(conToken(ctx.sesiones.socio))
        .query({ usuarioId: 99999999, estado: 'TODOS', perPage: 100 })
        .expect(200);
      expect(propio.body.items.map((p: { id: number }) => p.id)).toContain(pagoId);
      expect(propio.body.items.every((p: { usuarioId: number }) => p.usuarioId === ctx.usuarioId)).toBe(true);

      // Otro SOCIO y un EXTERNO piden el usuarioId del dueño: reciben lo suyo (que no tiene pagos), nunca lo ajeno.
      for (const sesion of [ctx.sesiones.socioAjeno, ctx.sesiones.externo]) {
        const ajeno = await http()
          .get('/api/v1/pagos')
          .set(conToken(sesion))
          .query({ usuarioId: ctx.usuarioId, estado: 'TODOS', perPage: 100 })
          .expect(200);
        expect(ajeno.body.total).toBe(0);
        expect(ajeno.body.items).toEqual([]);
      }
    });

    it('404 al ver o descargar el pago de otro (el mismo error que un pago inexistente)', async () => {
      const inexistente = await http().get('/api/v1/pagos/999999999').set(conToken(ctx.sesiones.socio)).expect(404);

      for (const sesion of [ctx.sesiones.socioAjeno, ctx.sesiones.externo]) {
        const visto = await http().get(`/api/v1/pagos/${pagoId}`).set(conToken(sesion)).expect(404);
        const descargado = await http().get(`/api/v1/pagos/${pagoId}/comprobante`).set(conToken(sesion)).expect(404);
        expect(visto.body.title).toBe(inexistente.body.title);
        expect(visto.body.detail).toBe(`No existe el pago ${pagoId}.`);
        expect(descargado.body.status).toBe(404);
      }
    });

    it('404 al cobrar una reserva o una membresía ajena, sin crear ningún pago', async () => {
      const reservaId = await ctx.crearReserva();
      const antes = await prisma.pago.count({ where: { usuario_id: ctx.usuarioId } });

      const reserva = await ctx.cobroReserva(reservaId, `ajena-r-${ctx.sufijo}`, undefined, ctx.sesiones.socioAjeno).expect(404);
      const membresia = await ctx.cobroMembresia(`ajena-m-${ctx.sufijo}`, undefined, ctx.sesiones.externo).expect(404);

      expect(reserva.body.detail).toBe(`No existe la reserva ${reservaId}.`);
      expect(membresia.body.detail).toBe(`No existe la membresía ${ctx.membresiaId}.`);
      expect(await prisma.pago.count({ where: { usuario_id: ctx.usuarioId } })).toBe(antes);
    });

    it('403 al anular, aunque el pago sea suyo', async () => {
      for (const sesion of [ctx.sesiones.socio, ctx.sesiones.socioAjeno, ctx.sesiones.externo]) {
        await http().post(`/api/v1/pagos/${pagoId}/anulaciones`).set(conToken(sesion)).expect(403);
      }
      const pago = await prisma.pago.findUniqueOrThrow({ where: { id: pagoId } });
      expect(pago.estado).toBe('APROBADO');
    });
  });

  describe('RECEPCION y GERENTE: todo', () => {
    it('listan todos los pagos y filtran por el usuario que pidan', async () => {
      for (const sesion of [ctx.sesiones.recepcion, ctx.sesiones.gerente]) {
        const lista = await http().get('/api/v1/pagos').set(conToken(sesion)).query({ perPage: 100 }).expect(200);
        expect(lista.body.items.map((p: { id: number }) => p.id)).toContain(pagoId);

        const filtrada = await http()
          .get('/api/v1/pagos')
          .set(conToken(sesion))
          .query({ usuarioId: ctx.usuarioId, perPage: 100 })
          .expect(200);
        expect(filtrada.body.items.every((p: { usuarioId: number }) => p.usuarioId === ctx.usuarioId)).toBe(true);
      }
    });

    it('ven y descargan cualquier pago', async () => {
      for (const sesion of [ctx.sesiones.recepcion, ctx.sesiones.gerente]) {
        await http().get(`/api/v1/pagos/${pagoId}`).set(conToken(sesion)).expect(200);
        await http().get(`/api/v1/pagos/${pagoId}/comprobante`).set(conToken(sesion)).expect(200);
      }
    });

    it('cobran cualquier concepto (cobro de mostrador)', async () => {
      const reservaId = await ctx.crearReserva();

      const res = await ctx.cobroReserva(reservaId, `mostrador-${ctx.sufijo}`, undefined, ctx.sesiones.recepcion).expect(201);

      expect(res.body).toMatchObject({ usuarioId: ctx.usuarioId, estado: 'APROBADO' });
    });

    it('anulan: 204 para RECEPCION y para GERENTE', async () => {
      for (const [rol, sesion] of [
        ['recepcion', ctx.sesiones.recepcion],
        ['gerente', ctx.sesiones.gerente],
      ] as const) {
        const cobrado = await ctx.cobroReserva(await ctx.crearReserva(), `anula-${rol}-${ctx.sufijo}`).expect(201);

        await http().post(`/api/v1/pagos/${cobrado.body.id}/anulaciones`).set(conToken(sesion)).expect(204);

        const pago = await prisma.pago.findUniqueOrThrow({ where: { id: cobrado.body.id } });
        expect(pago.estado).toBe('ANULADO');
      }
    });
  });
});
