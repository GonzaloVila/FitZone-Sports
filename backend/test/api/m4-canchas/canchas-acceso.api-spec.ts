import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp } from '@test/helpers/base-de-datos';
import { conToken } from '@test/helpers/sesion';
import { crearContextoM4 } from './m4.fixtures';

// E2E del acceso a las canchas: las cinco consultas (por sede, todas las sedes, por id y disponibilidad) son de cualquier
// rol con sesión, y el alta y la modificación son solo de GERENTE. Las reservas de canchas no se tocan acá.
describe('M4 - Canchas: sesión y alcance por rol', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof crearContextoM4>>;
  let canchaId: number;
  let token: Record<'socio' | 'externo' | 'recepcion' | 'gerente', string>;

  const http = () => request(app.getHttpServer());
  const nueva = () => ({ tipo: 'PADDLE', costoPorHora: 4000 });

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    ctx = await crearContextoM4(app, prisma);
    canchaId = ctx.canchaId;
    token = {
      socio: await ctx.crearSesion('SOCIO'),
      externo: await ctx.crearSesion('EXTERNO'),
      recepcion: await ctx.crearSesion('RECEPCION'),
      gerente: await ctx.crearSesion('GERENTE'),
    };
  });

  afterAll(async () => {
    await ctx.limpiar();
    await app.close();
  });

  it('sin token las seis operaciones responden 401', async () => {
    await http().get(`/api/v1/sedes/${ctx.sedeId}/canchas`).expect(401);
    await http().post(`/api/v1/sedes/${ctx.sedeId}/canchas`).send(nueva()).expect(401);
    await http().get('/api/v1/canchas').expect(401);
    await http().get(`/api/v1/canchas/${canchaId}`).expect(401);
    await http().patch(`/api/v1/canchas/${canchaId}`).send({ costoPorHora: 1 }).expect(401);
    await http().get(`/api/v1/canchas/${canchaId}/disponibilidad`).query({ fecha: ctx.DIA }).expect(401);

    const intacta = await prisma.cancha.findUniqueOrThrow({ where: { id: canchaId } });
    expect(Number(intacta.costo_por_hora)).toBe(5000);
  });

  it('SOCIO, EXTERNO, RECEPCION y GERENTE leen sedes y canchas', async () => {
    for (const t of Object.values(token)) {
      await http().get(`/api/v1/sedes/${ctx.sedeId}/canchas`).set(conToken(t)).expect(200);
      await http().get('/api/v1/canchas').set(conToken(t)).expect(200);
      await http().get(`/api/v1/canchas/${canchaId}`).set(conToken(t)).expect(200);
      await http().get(`/api/v1/canchas/${canchaId}/disponibilidad`).query({ fecha: ctx.DIA }).set(conToken(t)).expect(200);
    }
  });

  it('SOCIO, EXTERNO y RECEPCION no pueden crear ni editar: 403 y la cancha queda igual', async () => {
    const antes = await prisma.cancha.count({ where: { sede_id: ctx.sedeId } });

    for (const t of [token.socio, token.externo, token.recepcion]) {
      await http().post(`/api/v1/sedes/${ctx.sedeId}/canchas`).set(conToken(t)).send(nueva()).expect(403);
      const res = await http().patch(`/api/v1/canchas/${canchaId}`).set(conToken(t)).send({ costoPorHora: 1 }).expect(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
    }

    expect(await prisma.cancha.count({ where: { sede_id: ctx.sedeId } })).toBe(antes);
    const intacta = await prisma.cancha.findUniqueOrThrow({ where: { id: canchaId } });
    expect(Number(intacta.costo_por_hora)).toBe(5000);
  });

  it('GERENTE crea una cancha (201) y la edita (200)', async () => {
    const creada = await http().post(`/api/v1/sedes/${ctx.sedeId}/canchas`).set(conToken(token.gerente)).send(nueva()).expect(201);
    ctx.canchasCreadas.push(creada.body.id);

    const editada = await http()
      .patch(`/api/v1/canchas/${creada.body.id}`)
      .set(conToken(token.gerente))
      .send({ costoPorHora: 4500 })
      .expect(200);
    expect(editada.body.costoPorHora).toBe(4500);
  });

  it('el 403 por rol llega antes que la validación y que el 404', async () => {
    await http().post('/api/v1/sedes/2000000/canchas').set(conToken(token.socio)).send({}).expect(403);
    await http().patch('/api/v1/canchas/2000000').set(conToken(token.recepcion)).send({}).expect(403);
    await http().post('/api/v1/sedes/2000000/canchas').set(conToken(token.gerente)).send(nueva()).expect(404);
  });
});
