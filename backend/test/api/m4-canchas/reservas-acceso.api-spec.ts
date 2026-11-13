import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp } from '@test/helpers/base-de-datos';
import { conToken } from '@test/helpers/sesion';
import { crearContextoM4 } from './m4.fixtures';
import { diaFuturo } from '@test/helpers/fechas';

// E2E del acceso a /reservas-canchas: todo exige sesion y cualquier rol entra. SOCIO y EXTERNO reservan, ven y cancelan solo
// lo propio (lo ajeno es 404 y el listado se fuerza con su userId); RECEPCION y GERENTE operan por cualquiera, y su grilla
// de turnos lista reservas ajenas por cancha y día.
describe('M4 - Reservas de cancha: sesión y alcance por rol', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof crearContextoM4>>;
  let turno = 0; // cada reserva usa un turno distinto de la cancha base: 12 por día, desde el 1 de diciembre

  const gerente = {} as { token: string };
  const recepcion = {} as { token: string };
  const http = () => request(app.getHttpServer());

  // Un usuario (SOCIO vigente o EXTERNO) con su sesión.
  async function nuevo(rol: 'SOCIO' | 'EXTERNO') {
    const usuarioId = rol === 'SOCIO' ? await ctx.crearSocio({ vigente: true }) : await ctx.crearExterno();
    return { usuarioId, token: await ctx.tokenDe(usuarioId) };
  }
  const hh = (n: number) => String(n).padStart(2, '0');
  const cuerpo = (usuarioId: number, dia = diaFuturo(10 + Math.floor(turno / 12)), desde = 8 + (turno++ % 12)) => ({
    canchaId: ctx.canchaId,
    usuarioId,
    fechaHoraInicio: `${dia}T${hh(desde)}:00:00-03:00`,
    fechaHoraFin: `${dia}T${hh(desde + 1)}:00:00-03:00`,
  });
  // Una reserva ya hecha de ese usuario, creada por el GERENTE.
  const reservaDe = async (usuarioId: number, dia?: string, desde?: number) =>
    (await http().post('/api/v1/reservas-canchas').set(conToken(gerente.token)).send(cuerpo(usuarioId, dia, desde)).expect(201)).body.id as number;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    ctx = await crearContextoM4(app, prisma);
    gerente.token = await ctx.crearSesion('GERENTE');
    recepcion.token = await ctx.crearSesion('RECEPCION');
  });

  afterAll(async () => {
    await ctx.limpiar();
    await app.close();
  });

  it('sin token los cuatro endpoints cerrados responden 401', async () => {
    const { usuarioId } = await nuevo('EXTERNO');
    const id = await reservaDe(usuarioId);

    await http().get('/api/v1/reservas-canchas').expect(401);
    await http().post('/api/v1/reservas-canchas').send(cuerpo(usuarioId)).expect(401);
    await http().get(`/api/v1/reservas-canchas/${id}`).expect(401);
    await http().post(`/api/v1/reservas-canchas/${id}/cancelaciones`).expect(401);

    expect((await prisma.reserva.findUniqueOrThrow({ where: { id } })).estado).toBe('CONFIRMADA');
  });

  for (const rol of ['SOCIO', 'EXTERNO'] as const) {
    describe(`${rol}: solo lo propio`, () => {
      it('reserva a su nombre (201); con el usuarioId de otro es 404 y no se reserva', async () => {
        const [yo, otro] = [await nuevo(rol), await nuevo('EXTERNO')];
        await http().post('/api/v1/reservas-canchas').set(conToken(yo.token)).send(cuerpo(yo.usuarioId)).expect(201);

        const res = await http().post('/api/v1/reservas-canchas').set(conToken(yo.token)).send(cuerpo(otro.usuarioId)).expect(404);
        expect(res.body.detail).toBe('No existe el recurso solicitado para el id indicado.');
        expect(await prisma.reserva.count({ where: { usuario_id: otro.usuarioId } })).toBe(0);
      });

      it('el listado es solo lo suyo aunque mande el usuarioId de otro', async () => {
        const [yo, otro] = [await nuevo(rol), await nuevo('EXTERNO')];
        const [propia] = [await reservaDe(yo.usuarioId), await reservaDe(otro.usuarioId)];

        const res = await http().get('/api/v1/reservas-canchas').query({ usuarioId: otro.usuarioId }).set(conToken(yo.token)).expect(200);
        expect(res.body.items.map((r: { id: number }) => r.id)).toEqual([propia]);
        const sinFiltro = await http().get('/api/v1/reservas-canchas').set(conToken(yo.token)).expect(200);
        expect(sinFiltro.body.items.every((r: { usuarioId: number }) => r.usuarioId === yo.usuarioId)).toBe(true);
      });

      it('ve y cancela la suya; la de otro es 404 y sigue CONFIRMADA', async () => {
        const [yo, otro] = [await nuevo(rol), await nuevo('EXTERNO')];
        const [propia, ajena] = [await reservaDe(yo.usuarioId), await reservaDe(otro.usuarioId)];

        await http().get(`/api/v1/reservas-canchas/${propia}`).set(conToken(yo.token)).expect(200);
        await http().get(`/api/v1/reservas-canchas/${ajena}`).set(conToken(yo.token)).expect(404);
        await http().post(`/api/v1/reservas-canchas/${ajena}/cancelaciones`).set(conToken(yo.token)).expect(404);
        expect((await prisma.reserva.findUniqueOrThrow({ where: { id: ajena } })).estado).toBe('CONFIRMADA');

        await http().post(`/api/v1/reservas-canchas/${propia}/cancelaciones`).set(conToken(yo.token)).expect(204);
        expect((await prisma.reserva.findUniqueOrThrow({ where: { id: propia } })).estado).toBe('CANCELADA');
      });
    });
  }

  describe('RECEPCION y GERENTE: todo', () => {
    it('reservan por cualquier usuario', async () => {
      const [a, b] = [await nuevo('SOCIO'), await nuevo('EXTERNO')];
      await http().post('/api/v1/reservas-canchas').set(conToken(recepcion.token)).send(cuerpo(a.usuarioId)).expect(201);
      await http().post('/api/v1/reservas-canchas').set(conToken(gerente.token)).send(cuerpo(b.usuarioId)).expect(201);
    });

    it('la grilla lista reservas ajenas por cancha y día, y filtran por usuario si quieren', async () => {
      const [a, b] = [await nuevo('SOCIO'), await nuevo('EXTERNO')];
      // Un día aparte, con las dos reservas ajenas entre sí.
      const [rA, rB] = [await reservaDe(a.usuarioId, diaFuturo(20), 9), await reservaDe(b.usuarioId, diaFuturo(20), 10)];

      for (const t of [recepcion.token, gerente.token]) {
        const dia = await http().get('/api/v1/reservas-canchas').query({ canchaId: ctx.canchaId, fecha: diaFuturo(20), perPage: 100 }).set(conToken(t)).expect(200);
        const ids = dia.body.items.map((r: { id: number }) => r.id);
        expect(ids).toEqual(expect.arrayContaining([rA, rB]));

        const deB = await http().get('/api/v1/reservas-canchas').query({ usuarioId: b.usuarioId }).set(conToken(t)).expect(200);
        expect(deB.body.items.map((r: { id: number }) => r.id)).toEqual([rB]);
      }
    });

    it('ven y cancelan cualquier reserva', async () => {
      const [a, b] = [await nuevo('SOCIO'), await nuevo('EXTERNO')];
      const [rA, rB] = [await reservaDe(a.usuarioId), await reservaDe(b.usuarioId)];

      await http().get(`/api/v1/reservas-canchas/${rA}`).set(conToken(recepcion.token)).expect(200);
      await http().get(`/api/v1/reservas-canchas/${rB}`).set(conToken(gerente.token)).expect(200);
      await http().post(`/api/v1/reservas-canchas/${rA}/cancelaciones`).set(conToken(recepcion.token)).expect(204);
      await http().post(`/api/v1/reservas-canchas/${rB}/cancelaciones`).set(conToken(gerente.token)).expect(204);
      await http().get('/api/v1/reservas-canchas/2000000').set(conToken(gerente.token)).expect(404);
    });
  });
});
