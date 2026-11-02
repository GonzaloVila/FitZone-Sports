import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { PRECIOS_PLAN } from 'src/modules/m1-usuarios/entities/membresia.entity';
import { crearApp, dniUnico, emailUnico } from '@test/helpers/base-de-datos';
import { conToken, crearRecepcionConSesion, crearUsuarioConSesion } from '@test/helpers/sesion';

// E2E del acceso a /sedes e /ingresos: GET /sedes es de cualquier rol con sesion, POST /sedes de GERENTE, y aforo, detalle
// y alta de ingreso de RECEPCION (solo su sede, 403 si es otra) y GERENTE (cualquiera). Los 403 de negocio que ya existian
// (membresia inactiva) siguen igual.
describe('M2 - Sedes e ingresos: sesion y alcance por rol', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];
  const sedesCreadas: number[] = [];

  let sedeA: number;
  let sedeB: number;
  let ingresoA: number;
  let ingresoB: number;
  let socioLibre: number;
  let socioSinMembresia: number;
  const token = {} as Record<'socio' | 'externo' | 'recepcionA' | 'gerente', string>;

  const http = () => request(app.getHttpServer());

  async function crearSocio(sedeId: number, conMembresia = true): Promise<number> {
    const usuario = await prisma.usuario.create({
      data: { rol: 'SOCIO', dni: dniUnico(), nombre: 'Socio E2E acceso', email: emailUnico('m2.acceso'), contrasenia: 'hash' },
    });
    usuariosCreados.push(usuario.id);
    const socio = await prisma.socio.create({
      data: { usuario_id: usuario.id, sede_origen_id: sedeId, fecha_alta: new Date() },
    });
    sociosCreados.push(socio.id);
    if (conMembresia) {
      const ahora = new Date();
      const fechaFin = new Date(ahora);
      fechaFin.setDate(fechaFin.getDate() + 30);
      await prisma.membresia.create({
        data: {
          socio_id: socio.id,
          plan: 'MENSUAL',
          estado: 'ACTIVA',
          fecha_inicio: ahora,
          fecha_fin: fechaFin,
          precio: PRECIOS_PLAN.MENSUAL,
          renueva_automatica: false,
        },
      });
    }
    return socio.id;
  }

  async function crearSede(nombre: string): Promise<number> {
    const sede = await prisma.sede.create({ data: { nombre, direccion: 'Calle Acceso 1', aforo_maximo: 20 } });
    sedesCreadas.push(sede.id);
    return sede.id;
  }

  async function sesion(rol: 'SOCIO' | 'EXTERNO' | 'GERENTE'): Promise<string> {
    const { usuarioId, token: t } = await crearUsuarioConSesion(app, prisma, rol, 'm2.acceso');
    usuariosCreados.push(usuarioId);
    return t;
  }

  const ingreso = (sedeId: number, socioId: number) => ({ sedeId, socioId, codigoTotp: '123456' });

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    sedeA = await crearSede('Sede E2E acceso A');
    sedeB = await crearSede('Sede E2E acceso B');

    const recepcion = await crearRecepcionConSesion(app, prisma, sedeA, 'm2.acceso');
    usuariosCreados.push(recepcion.usuarioId);
    token.recepcionA = recepcion.token;
    token.socio = await sesion('SOCIO');
    token.externo = await sesion('EXTERNO');
    token.gerente = await sesion('GERENTE');

    const ahora = new Date();
    ingresoA = (await prisma.ingreso.create({ data: { sede_id: sedeA, socio_id: await crearSocio(sedeA), fecha_hora_ingreso: ahora } })).id;
    ingresoB = (await prisma.ingreso.create({ data: { sede_id: sedeB, socio_id: await crearSocio(sedeB), fecha_hora_ingreso: ahora } })).id;
    socioLibre = await crearSocio(sedeA);
    socioSinMembresia = await crearSocio(sedeA, false);
  });

  afterAll(async () => {
    await prisma.ingreso.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.empleadoSede.deleteMany({ where: { usuario_id: { in: usuariosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.deleteMany({ where: { id: { in: sedesCreadas } } });
    await app.close();
  });

  it('sin token los cinco endpoints cerrados responden 401', async () => {
    await http().get('/api/v1/sedes').expect(401);
    await http().post('/api/v1/sedes').send({ nombre: 'Sin sesion', direccion: 'Calle 1', aforoMaximo: 5 }).expect(401);
    await http().get(`/api/v1/sedes/${sedeA}/aforo`).expect(401);
    await http().get(`/api/v1/ingresos/${ingresoA}`).expect(401);
    await http().post('/api/v1/ingresos').send(ingreso(sedeA, socioLibre)).expect(401);

    expect(await prisma.ingreso.count({ where: { socio_id: socioLibre } })).toBe(0);
  });

  it('un token inválido también es 401', async () => {
    await http().get('/api/v1/sedes').set(conToken('token-falso')).expect(401);
  });

  describe('GET /sedes', () => {
    it('lo lee cualquier rol con sesión', async () => {
      for (const t of [token.socio, token.externo, token.recepcionA, token.gerente]) {
        const res = await http().get('/api/v1/sedes').set(conToken(t)).expect(200);
        expect(res.body.items).toEqual(expect.any(Array));
      }
    });
  });

  describe('POST /sedes', () => {
    const cuerpo = () => ({ nombre: 'Sede E2E acceso alta', direccion: 'Calle Alta 1', aforoMaximo: 8 });

    it('SOCIO, EXTERNO y RECEPCION reciben 403 y no se crea la sede', async () => {
      for (const t of [token.socio, token.externo, token.recepcionA]) {
        await http().post('/api/v1/sedes').set(conToken(t)).send(cuerpo()).expect(403);
      }
      expect(await prisma.sede.count({ where: { nombre: cuerpo().nombre } })).toBe(0);
    });

    it('GERENTE la crea con 201 y Location', async () => {
      const res = await http().post('/api/v1/sedes').set(conToken(token.gerente)).send(cuerpo()).expect(201);
      sedesCreadas.push(res.body.id);

      expect(res.headers.location).toBe(`/api/v1/sedes/${res.body.id}`);
    });
  });

  describe('GET /sedes/{sedeId}/aforo', () => {
    it('SOCIO y EXTERNO reciben 403', async () => {
      await http().get(`/api/v1/sedes/${sedeA}/aforo`).set(conToken(token.socio)).expect(403);
      await http().get(`/api/v1/sedes/${sedeA}/aforo`).set(conToken(token.externo)).expect(403);
    });

    it('RECEPCION ve el aforo de su sede, y el de otra es 403', async () => {
      const propio = await http().get(`/api/v1/sedes/${sedeA}/aforo`).set(conToken(token.recepcionA)).expect(200);
      expect(propio.body).toMatchObject({ aforoActual: expect.any(Number), aforoMaximo: 20 });

      const ajeno = await http().get(`/api/v1/sedes/${sedeB}/aforo`).set(conToken(token.recepcionA)).expect(403);
      expect(ajeno.headers['content-type']).toContain('application/problem+json');
      expect(ajeno.body.detail).toBe(`La sede ${sedeB} no es la sede de trabajo del recepcionista.`);
    });

    it('GERENTE ve cualquier sede', async () => {
      await http().get(`/api/v1/sedes/${sedeA}/aforo`).set(conToken(token.gerente)).expect(200);
      await http().get(`/api/v1/sedes/${sedeB}/aforo`).set(conToken(token.gerente)).expect(200);
    });
  });

  describe('GET /ingresos/{ingresoId}', () => {
    it('SOCIO y EXTERNO reciben 403', async () => {
      await http().get(`/api/v1/ingresos/${ingresoA}`).set(conToken(token.socio)).expect(403);
      await http().get(`/api/v1/ingresos/${ingresoA}`).set(conToken(token.externo)).expect(403);
    });

    it('RECEPCION ve un ingreso de su sede, y uno de otra es 403 con el texto del egreso', async () => {
      const propio = await http().get(`/api/v1/ingresos/${ingresoA}`).set(conToken(token.recepcionA)).expect(200);
      expect(propio.body).toMatchObject({ id: ingresoA, sedeId: sedeA });

      const ajeno = await http().get(`/api/v1/ingresos/${ingresoB}`).set(conToken(token.recepcionA)).expect(403);
      expect(ajeno.body.detail).toBe(`El ingreso ${ingresoB} no pertenece a la sede del recepcionista.`);
    });

    it('GERENTE ve cualquiera, y un ingreso inexistente sigue siendo 404', async () => {
      await http().get(`/api/v1/ingresos/${ingresoB}`).set(conToken(token.gerente)).expect(200);
      await http().get('/api/v1/ingresos/2000000').set(conToken(token.gerente)).expect(404);
      await http().get('/api/v1/ingresos/2000000').set(conToken(token.recepcionA)).expect(404);
    });
  });

  describe('POST /ingresos', () => {
    it('SOCIO y EXTERNO reciben 403 y no se registra nada', async () => {
      await http().post('/api/v1/ingresos').set(conToken(token.socio)).send(ingreso(sedeA, socioLibre)).expect(403);
      await http().post('/api/v1/ingresos').set(conToken(token.externo)).send(ingreso(sedeA, socioLibre)).expect(403);

      expect(await prisma.ingreso.count({ where: { socio_id: socioLibre } })).toBe(0);
    });

    it('RECEPCION con una sede ajena en el body recibe 403 y no se registra nada', async () => {
      const res = await http()
        .post('/api/v1/ingresos')
        .set(conToken(token.recepcionA))
        .send(ingreso(sedeB, socioLibre))
        .expect(403);

      expect(res.body.type).toBe('https://fitzone.app/errores/sede-fuera-de-alcance');
      expect(await prisma.ingreso.count({ where: { socio_id: socioLibre } })).toBe(0);
    });

    it('la membresía inactiva sigue siendo su propio 403', async () => {
      const res = await http()
        .post('/api/v1/ingresos')
        .set(conToken(token.recepcionA))
        .send(ingreso(sedeA, socioSinMembresia))
        .expect(403);

      expect(res.body.type).toBe('https://fitzone.app/errores/membresia-inactiva');
    });

    it('RECEPCION registra en su sede (201 y Location) y GERENTE en cualquiera', async () => {
      const propio = await http()
        .post('/api/v1/ingresos')
        .set(conToken(token.recepcionA))
        .send(ingreso(sedeA, socioLibre))
        .expect(201);
      expect(propio.headers.location).toBe(`/api/v1/ingresos/${propio.body.id}`);

      const otroSocio = await crearSocio(sedeB);
      const ajena = await http()
        .post('/api/v1/ingresos')
        .set(conToken(token.gerente))
        .send(ingreso(sedeB, otroSocio))
        .expect(201);
      expect(ajena.body.sedeId).toBe(sedeB);
    });
  });
});
