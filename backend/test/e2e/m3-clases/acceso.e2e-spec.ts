import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp } from '@test/helpers/base-de-datos';
import { conToken } from '@test/helpers/sesion';
import { crearContextoM3 } from './m3.fixtures';

// E2E del acceso a clases, reservas de clase y esperas: todo exige sesion y el EXTERNO nunca entra (403); crear clases es de
// RECEPCION (solo su sede) y GERENTE; los inscriptos son solo del personal; el SOCIO reserva, se anota, ve, cancela, sale y
// confirma solo lo suyo (lo ajeno es 404 y los listados se fuerzan con su socioId); RECEPCION y GERENTE operan por cualquiera.
describe('M3 - Clases, reservas y esperas: sesión y alcance por rol', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof crearContextoM3>>;
  let sedeOtra: number;
  let clase: number;
  let claseLlena: number;
  const token = {} as Record<'externo' | 'recepcion' | 'gerente' | 'huerfano', string>;

  const http = () => request(app.getHttpServer());
  const proximo = (horas: number) => new Date(Date.now() + horas * 3600 * 1000);

  async function nuevoSocio() {
    const socio = await ctx.crearSocioConMembresia({ vigente: true });
    return { ...socio, token: await ctx.tokenDe(socio.usuarioId) };
  }
  const reservaDe = async (socioId: number) =>
    (await prisma.reservaClase.create({ data: { clase_id: clase, socio_id: socioId, estado: 'CONFIRMADA' } })).id;
  const esperaDe = async (socioId: number) =>
    (await prisma.esperaClase.create({
      data: { clase_id: claseLlena, socio_id: socioId, estado: 'EN_ESPERA', fecha_anotacion: new Date() },
    })).id;
  const cuerpoClase = (sedeId: number) => ({
    sedeId, tipo: 'Acceso', instructor: 'Profe', horarioInicio: proximo(24).toISOString(), horarioFin: proximo(25).toISOString(), capacidad: 5,
  });

  async function crearClasePrisma(capacidad: number): Promise<number> {
    const c = await prisma.clase.create({
      data: { sede_id: ctx.sedeId, tipo: 'Acceso', instructor: 'Profe', horario_inicio: proximo(24), horario_fin: proximo(25), capacidad },
    });
    ctx.clasesCreadas.push(c.id);
    return c.id;
  }

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    ctx = await crearContextoM3(app, prisma);
    sedeOtra = (await prisma.sede.create({ data: { nombre: 'Sede E2E acceso M3', direccion: 'Calle 1', aforo_maximo: 5 } })).id;
    token.externo = await ctx.crearSesion('EXTERNO');
    token.recepcion = await ctx.crearRecepcion(ctx.sedeId);
    token.gerente = await ctx.crearSesion('GERENTE');
    token.huerfano = await ctx.crearSesion('SOCIO'); // SOCIO cuyo token no trae socioId
    clase = await crearClasePrisma(50);
    claseLlena = await crearClasePrisma(1);
    await prisma.reservaClase.create({ data: { clase_id: claseLlena, socio_id: (await nuevoSocio()).socioId, estado: 'CONFIRMADA' } });
  });

  afterAll(async () => {
    await ctx.limpiar();
    await prisma.clase.deleteMany({ where: { sede_id: sedeOtra } });
    await prisma.sede.delete({ where: { id: sedeOtra } });
    await app.close();
  });

  // Los catorce endpoints de clases, esperas y reservas de clase, con ids que existen.
  async function endpoints() {
    const s = await nuevoSocio();
    const [reservaId, esperaId] = [await reservaDe(s.socioId), await esperaDe(s.socioId)];
    return [
      ['post', '/api/v1/clases', cuerpoClase(ctx.sedeId)], ['get', '/api/v1/clases'], ['get', `/api/v1/clases/${clase}`],
      ['get', `/api/v1/clases/${clase}/reservas`], ['get', `/api/v1/clases/${claseLlena}/espera`],
      ['post', '/api/v1/reservas-clases', { claseId: clase, socioId: s.socioId }], ['get', '/api/v1/reservas-clases'],
      ['get', `/api/v1/reservas-clases/${reservaId}`], ['post', `/api/v1/reservas-clases/${reservaId}/cancelaciones`],
      ['post', `/api/v1/clases/${claseLlena}/espera`, { socioId: s.socioId }], ['get', '/api/v1/esperas-clases'],
      ['get', `/api/v1/esperas-clases/${esperaId}`], ['delete', `/api/v1/esperas-clases/${esperaId}`],
      ['post', `/api/v1/esperas-clases/${esperaId}/confirmaciones`],
    ] as [ 'get' | 'post' | 'delete', string, object? ][];
  }
  const llamar = (m: 'get' | 'post' | 'delete', url: string, cuerpo?: object, t?: string) => {
    const r = http()[m](url);
    return cuerpo ? (t ? r.set(conToken(t)).send(cuerpo) : r.send(cuerpo)) : t ? r.set(conToken(t)) : r;
  };

  it('sin token los catorce endpoints cerrados responden 401', async () => {
    for (const [m, url, cuerpo] of await endpoints()) {
      expect((await llamar(m, url, cuerpo)).status, `${m} ${url}`).toBe(401);
    }
  });

  it('el EXTERNO recibe 403 en todos los endpoints de clases', async () => {
    for (const [m, url, cuerpo] of await endpoints()) {
      expect((await llamar(m, url, cuerpo, token.externo)).status, `${m} ${url}`).toBe(403);
    }
  });

  describe('POST /clases y GET /clases/{id}/reservas', () => {
    it('SOCIO recibe 403 en el alta y en los inscriptos; lee agenda, detalle y cola', async () => {
      const s = await nuevoSocio();
      await http().post('/api/v1/clases').set(conToken(s.token)).send(cuerpoClase(ctx.sedeId)).expect(403);
      await http().get(`/api/v1/clases/${clase}/reservas`).set(conToken(s.token)).expect(403);
      await http().get('/api/v1/clases').set(conToken(s.token)).expect(200);
      await http().get(`/api/v1/clases/${clase}`).set(conToken(s.token)).expect(200);
      await http().get(`/api/v1/clases/${claseLlena}/espera`).set(conToken(s.token)).expect(200);
    });

    it('RECEPCION crea en su sede (201) y recibe 403 en otra; GERENTE crea en cualquiera', async () => {
      const propia = await http().post('/api/v1/clases').set(conToken(token.recepcion)).send(cuerpoClase(ctx.sedeId)).expect(201);
      ctx.clasesCreadas.push(propia.body.id);
      const ajena = await http().post('/api/v1/clases').set(conToken(token.recepcion)).send(cuerpoClase(sedeOtra)).expect(403);
      expect(ajena.body.detail).toBe(`La sede ${sedeOtra} no es la sede de trabajo del recepcionista.`);
      expect(await prisma.clase.count({ where: { sede_id: sedeOtra } })).toBe(0);

      const deGerente = await http().post('/api/v1/clases').set(conToken(token.gerente)).send(cuerpoClase(sedeOtra)).expect(201);
      expect(deGerente.body.sedeId).toBe(sedeOtra);
    });

    it('RECEPCION y GERENTE ven los inscriptos', async () => {
      await http().get(`/api/v1/clases/${clase}/reservas`).set(conToken(token.recepcion)).expect(200);
      await http().get(`/api/v1/clases/${clase}/reservas`).set(conToken(token.gerente)).expect(200);
    });
  });

  describe('reservas de clase', () => {
    it('el SOCIO reserva solo a su nombre; con el socioId de otro es 404 y no se reserva', async () => {
      const [a, b] = [await nuevoSocio(), await nuevoSocio()];
      await http().post('/api/v1/reservas-clases').set(conToken(a.token)).send({ claseId: clase, socioId: a.socioId }).expect(201);

      const res = await http().post('/api/v1/reservas-clases').set(conToken(a.token)).send({ claseId: clase, socioId: b.socioId }).expect(404);
      expect(res.body.detail).toBe('El socio indicado no existe.');
      expect(await prisma.reservaClase.count({ where: { clase_id: clase, socio_id: b.socioId } })).toBe(0);
    });

    it('RECEPCION y GERENTE reservan por cualquier socio', async () => {
      const [a, b] = [await nuevoSocio(), await nuevoSocio()];
      await http().post('/api/v1/reservas-clases').set(conToken(token.recepcion)).send({ claseId: clase, socioId: a.socioId }).expect(201);
      await http().post('/api/v1/reservas-clases').set(conToken(token.gerente)).send({ claseId: clase, socioId: b.socioId }).expect(201);
    });

    it('el listado del SOCIO es solo lo suyo aunque mande otro socioId; RECEPCION y GERENTE ven lo que filtran', async () => {
      const [a, b] = [await nuevoSocio(), await nuevoSocio()];
      await reservaDe(a.socioId);
      await reservaDe(b.socioId);

      const propio = await http().get('/api/v1/reservas-clases').query({ socioId: b.socioId }).set(conToken(a.token)).expect(200);
      expect(propio.body.items.map((r: { socioId: number }) => r.socioId)).toEqual([a.socioId]);

      for (const t of [token.recepcion, token.gerente]) {
        const todo = await http().get('/api/v1/reservas-clases').query({ socioId: b.socioId }).set(conToken(t)).expect(200);
        expect(todo.body.items.map((r: { socioId: number }) => r.socioId)).toEqual([b.socioId]);
      }
    });

    it('el SOCIO ve y cancela la suya; la de otro es 404 y sigue CONFIRMADA; el personal ve y cancela cualquiera', async () => {
      const [a, b] = [await nuevoSocio(), await nuevoSocio()];
      const [rA, rB] = [await reservaDe(a.socioId), await reservaDe(b.socioId)];

      await http().get(`/api/v1/reservas-clases/${rA}`).set(conToken(a.token)).expect(200);
      const ajena = await http().get(`/api/v1/reservas-clases/${rB}`).set(conToken(a.token)).expect(404);
      expect(ajena.body.detail).toBe('No existe el recurso solicitado para el id indicado.');
      await http().post(`/api/v1/reservas-clases/${rB}/cancelaciones`).set(conToken(a.token)).expect(404);
      expect((await prisma.reservaClase.findUniqueOrThrow({ where: { id: rB } })).estado).toBe('CONFIRMADA');

      await http().post(`/api/v1/reservas-clases/${rA}/cancelaciones`).set(conToken(a.token)).expect(204);
      for (const t of [token.recepcion, token.gerente]) {
        await http().get(`/api/v1/reservas-clases/${rB}`).set(conToken(t)).expect(200);
      }
      await http().post(`/api/v1/reservas-clases/${rB}/cancelaciones`).set(conToken(token.recepcion)).expect(204);
      const rC = await reservaDe((await nuevoSocio()).socioId);
      await http().post(`/api/v1/reservas-clases/${rC}/cancelaciones`).set(conToken(token.gerente)).expect(204);
    });
  });

  describe('esperas', () => {
    it('el SOCIO se anota solo a su nombre; con el socioId de otro es 404; el personal anota a cualquiera', async () => {
      const [a, b, c, d] = [await nuevoSocio(), await nuevoSocio(), await nuevoSocio(), await nuevoSocio()];
      const url = `/api/v1/clases/${claseLlena}/espera`;
      await http().post(url).set(conToken(a.token)).send({ socioId: a.socioId }).expect(201);
      await http().post(url).set(conToken(a.token)).send({ socioId: b.socioId }).expect(404);
      expect(await prisma.esperaClase.count({ where: { socio_id: b.socioId } })).toBe(0);

      await http().post(url).set(conToken(token.recepcion)).send({ socioId: c.socioId }).expect(201);
      await http().post(url).set(conToken(token.gerente)).send({ socioId: d.socioId }).expect(201);
    });

    it('el listado del SOCIO es solo lo suyo aunque mande otro socioId; el personal ve lo que filtra', async () => {
      const [a, b] = [await nuevoSocio(), await nuevoSocio()];
      await esperaDe(a.socioId);
      await esperaDe(b.socioId);

      const propio = await http().get('/api/v1/esperas-clases').query({ socioId: b.socioId }).set(conToken(a.token)).expect(200);
      expect(propio.body.items.map((e: { socioId: number }) => e.socioId)).toEqual([a.socioId]);
      const todo = await http().get('/api/v1/esperas-clases').query({ socioId: b.socioId }).set(conToken(token.gerente)).expect(200);
      expect(todo.body.items.map((e: { socioId: number }) => e.socioId)).toEqual([b.socioId]);
    });

    it('el SOCIO ve, sale y confirma solo la suya; la de otro es 404 y no se toca; el personal opera cualquiera', async () => {
      const [a, b, c] = [await nuevoSocio(), await nuevoSocio(), await nuevoSocio()];
      const [eA, eB, eC] = [await esperaDe(a.socioId), await esperaDe(b.socioId), await esperaDe(c.socioId)];

      await http().get(`/api/v1/esperas-clases/${eA}`).set(conToken(a.token)).expect(200);
      await http().get(`/api/v1/esperas-clases/${eB}`).set(conToken(a.token)).expect(404);
      await http().delete(`/api/v1/esperas-clases/${eB}`).set(conToken(a.token)).expect(404);
      await http().post(`/api/v1/esperas-clases/${eB}/confirmaciones`).set(conToken(a.token)).expect(404);
      expect((await prisma.esperaClase.findUniqueOrThrow({ where: { id: eB } })).estado).toBe('EN_ESPERA');

      // Confirmar la propia pasa el alcance y llega a la regla de negocio: todavía no fue notificada (409).
      await http().post(`/api/v1/esperas-clases/${eA}/confirmaciones`).set(conToken(a.token)).expect(409);
      await http().delete(`/api/v1/esperas-clases/${eA}`).set(conToken(a.token)).expect(204);

      await http().post(`/api/v1/esperas-clases/${eB}/confirmaciones`).set(conToken(token.recepcion)).expect(409);
      await http().get(`/api/v1/esperas-clases/${eB}`).set(conToken(token.gerente)).expect(200);
      await http().delete(`/api/v1/esperas-clases/${eB}`).set(conToken(token.recepcion)).expect(204);
      await http().delete(`/api/v1/esperas-clases/${eC}`).set(conToken(token.gerente)).expect(204);
    });
  });

  describe('SOCIO cuyo token no trae socioId', () => {
    it('recibe 403 en listados y altas, y 404 en recursos por id, sin ver datos de otros', async () => {
      const s = await nuevoSocio();
      const [r, e] = [await reservaDe(s.socioId), await esperaDe(s.socioId)];
      const h = token.huerfano;

      await http().get('/api/v1/reservas-clases').set(conToken(h)).expect(403);
      await http().get('/api/v1/esperas-clases').set(conToken(h)).expect(403);
      await http().post('/api/v1/reservas-clases').set(conToken(h)).send({ claseId: clase, socioId: s.socioId }).expect(403);
      await http().post(`/api/v1/clases/${claseLlena}/espera`).set(conToken(h)).send({ socioId: s.socioId }).expect(403);
      await http().get(`/api/v1/reservas-clases/${r}`).set(conToken(h)).expect(404);
      await http().post(`/api/v1/reservas-clases/${r}/cancelaciones`).set(conToken(h)).expect(404);
      await http().get(`/api/v1/esperas-clases/${e}`).set(conToken(h)).expect(404);
      await http().delete(`/api/v1/esperas-clases/${e}`).set(conToken(h)).expect(404);
    });
  });
});
