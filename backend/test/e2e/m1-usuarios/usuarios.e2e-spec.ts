import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp, dniUnico, emailUnico } from '@test/helpers/base-de-datos';
import { crearContextoM1 } from './m1.fixtures';

// E2E de usuarios: listado con filtros (y que `contrasenia` no viaje), el PATCH que
// limpia telefono/foto con null y el alta de RECEPCION con sede de trabajo (A3).
// La validación de DTOs vive en los specs de DTO.
describe('M1 - Usuarios', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof crearContextoM1>>;

  // Solo para el alta con sede: la limpieza de crearContextoM1 esta acotada al
  // prefijo `socio.` y a su propia sede, asi que estos datos se limpian aca.
  const usuariosCreados: number[] = [];
  const sedesCreadas: number[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    ctx = await crearContextoM1(app, prisma);
  });

  afterAll(async () => {
    await prisma.empleadoSede.deleteMany({ where: { usuario_id: { in: usuariosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.deleteMany({ where: { id: { in: sedesCreadas } } });
    await ctx.limpiar();
    await app.close();
  });

  it('GET /usuarios: listado plano, filtros y sin exponer contrasenia', async () => {
    const emailAna = ctx.emailSocio();
    await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({ rol: 'EXTERNO', dni: dniUnico(), nombre: 'Ana Gómez', email: emailAna, contrasenia: 'clave12345' })
      .expect(201);

    const todos = await request(app.getHttpServer()).get('/api/v1/usuarios').query({ perPage: 100 }).expect(200);
    const ana = todos.body.items.find((u: { email: string }) => u.email === emailAna);
    expect(ana).toBeDefined();
    expect(ana.contrasenia).toBeUndefined();
    expect(ana.sedeId).toBeNull();

    const porNombre = await request(app.getHttpServer()).get('/api/v1/usuarios').query({ nombre: 'ana' }).expect(200);
    expect(porNombre.body.items.map((u: { email: string }) => u.email)).toContain(emailAna);

    const porEmail = await request(app.getHttpServer()).get('/api/v1/usuarios').query({ email: emailAna }).expect(200);
    expect(porEmail.body.items).toHaveLength(1);
    expect(porEmail.body.total).toBe(1);
  });

  it('PATCH /usuarios/{id} acepta null para limpiar telefono y foto_url', async () => {
    const usuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Patch Null E2E',
        email: ctx.emailSocio(),
        contrasenia: 'clave12345',
        telefono: '+54 351 555-0000',
        fotoUrl: 'https://cdn.fitzone.com.ar/fotos/patch.jpg',
      })
      .expect(201);

    const limpiado = await request(app.getHttpServer())
      .patch(`/api/v1/usuarios/${usuarioRes.body.id}`)
      .send({ telefono: null, fotoUrl: null })
      .expect(200);

    expect(limpiado.body.telefono).toBeNull();
    expect(limpiado.body.fotoUrl).toBeNull();
  });

  describe('Alta de RECEPCION con sede de trabajo (A3)', () => {
    async function crearSedeE2E(): Promise<number> {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sedes')
        .send({ nombre: 'Sede Alta Recepcion E2E', direccion: 'Calle Recepcion 123', aforoMaximo: 10 })
        .expect(201);
      sedesCreadas.push(res.body.id);
      return res.body.id as number;
    }

    function datosRecepcion(over: Record<string, unknown> = {}) {
      return {
        rol: 'RECEPCION',
        dni: dniUnico(),
        nombre: 'Recep E2E M1',
        email: emailUnico('recep'),
        contrasenia: 'clave12345',
        ...over,
      };
    }

    it('201 con sede libre: crea la fila de EmpleadoSede y el login trae sedeId', async () => {
      const sedeId = await crearSedeE2E();
      const email = emailUnico('recep');

      const creado = await request(app.getHttpServer())
        .post('/api/v1/usuarios')
        .send(datosRecepcion({ email, sedeId }))
        .expect(201);
      usuariosCreados.push(creado.body.id);

      // La UI de staff muestra y descarta las sedes ocupadas con este dato.
      expect(creado.body.sedeId).toBe(sedeId);

      const fila = await prisma.empleadoSede.findUnique({ where: { usuario_id: creado.body.id } });
      expect(fila).toMatchObject({ usuario_id: creado.body.id, sede_id: sedeId });

      const detalle = await request(app.getHttpServer())
        .get(`/api/v1/usuarios/${creado.body.id}`)
        .expect(200);
      expect(detalle.body.sedeId).toBe(sedeId);

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, contrasenia: 'clave12345' })
        .expect(200);
      expect(login.body).toMatchObject({ rol: 'RECEPCION', sedeId });
    });

    it('422 si RECEPCION no manda sedeId', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/usuarios')
        .send(datosRecepcion())
        .expect(422);
      expect(res.body.detail).toContain('sedeId');
    });

    it('422 si EXTERNO manda sedeId (la sede no aplica a ese rol)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/usuarios')
        .send(datosRecepcion({ rol: 'EXTERNO', sedeId: 1 }))
        .expect(422);
      expect(res.body.detail).toContain('RECEPCION');
    });

    it('404 si la sede no existe', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/usuarios')
        .send(datosRecepcion({ sedeId: 2_000_000 }))
        .expect(404);
    });

    it('409 si la sede ya tiene recepcionista, y no crea la segunda cuenta', async () => {
      const sedeId = await crearSedeE2E();
      const primero = await request(app.getHttpServer())
        .post('/api/v1/usuarios')
        .send(datosRecepcion({ sedeId }))
        .expect(201);
      usuariosCreados.push(primero.body.id);

      const emailSegundo = emailUnico('recep');
      const res = await request(app.getHttpServer())
        .post('/api/v1/usuarios')
        .send(datosRecepcion({ email: emailSegundo, sedeId }))
        .expect(409);
      expect(res.body.title).toBe('La sede ya tiene un recepcionista');
      expect(await prisma.usuario.findUnique({ where: { email: emailSegundo } })).toBeNull();
    });
  });
});
