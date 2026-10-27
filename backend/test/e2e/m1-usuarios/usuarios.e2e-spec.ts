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

  // GET /usuarios?sedeId=: sede de trabajo (EmpleadoSede). Una sede tiene a lo sumo un
  // recepcionista, asi que cada sede de este bloque devuelve 0 o 1 usuario.
  describe('GET /usuarios?sedeId= (sede de trabajo)', () => {
    let sedeConRecepcion: number;
    let sedeSinRecepcion: number;
    let recepcionId: number;
    let emailRecepcion: string;
    let externoId: number;
    let emailExterno: string;

    async function crearSedeE2E(nombre: string): Promise<number> {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sedes')
        .send({ nombre, direccion: 'Calle Listado Usuarios 1', aforoMaximo: 10 })
        .expect(201);
      sedesCreadas.push(res.body.id);
      return res.body.id as number;
    }

    function listar(query: Record<string, string | number> = {}) {
      return request(app.getHttpServer()).get('/api/v1/usuarios').query(query);
    }

    const idsDe = (res: request.Response) => res.body.items.map((u: { id: number }) => u.id);

    beforeAll(async () => {
      sedeConRecepcion = await crearSedeE2E('Sede E2E usuarios con recepcion');
      sedeSinRecepcion = await crearSedeE2E('Sede E2E usuarios sin recepcion');

      emailRecepcion = emailUnico('recep');
      const recepcion = await request(app.getHttpServer())
        .post('/api/v1/usuarios')
        .send({
          rol: 'RECEPCION',
          dni: dniUnico(),
          nombre: 'Recepcion Filtro Sede E2E',
          email: emailRecepcion,
          contrasenia: 'clave12345',
          sedeId: sedeConRecepcion,
        })
        .expect(201);
      recepcionId = recepcion.body.id;
      usuariosCreados.push(recepcionId);

      emailExterno = emailUnico('externo');
      const externo = await request(app.getHttpServer())
        .post('/api/v1/usuarios')
        .send({
          rol: 'EXTERNO',
          dni: dniUnico(),
          nombre: 'Externo Sin Puesto E2E',
          email: emailExterno,
          contrasenia: 'clave12345',
        })
        .expect(201);
      externoId = externo.body.id;
      usuariosCreados.push(externoId);
    });

    it('200 con el usuario que tiene puesto en esa sede, con su sedeId y sin contrasenia', async () => {
      const res = await listar({ sedeId: sedeConRecepcion }).expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({ id: recepcionId, rol: 'RECEPCION', sedeId: sedeConRecepcion });
      expect(res.body.items[0].contrasenia).toBeUndefined();
    });

    it('una sede sin recepcionista responde 200 con lista vacia', async () => {
      const res = await listar({ sedeId: sedeSinRecepcion }).expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    // Criterio: igual que GET /ingresos?sedeId y GET /socios?sedeOrigenId, un sedeId
    // inexistente no es 404 sino lista vacia.
    it('un sedeId inexistente responde 200 con lista vacia (no 404)', async () => {
      const res = await listar({ sedeId: 2_000_000 }).expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it('se combina con rol, nombre y email', async () => {
      expect(idsDe(await listar({ sedeId: sedeConRecepcion, rol: 'RECEPCION' }).expect(200))).toEqual([recepcionId]);
      expect(idsDe(await listar({ sedeId: sedeConRecepcion, rol: 'GERENTE' }).expect(200))).toEqual([]);
      expect(idsDe(await listar({ sedeId: sedeConRecepcion, nombre: 'filtro sede' }).expect(200))).toEqual([recepcionId]);
      expect(idsDe(await listar({ sedeId: sedeConRecepcion, nombre: 'otra persona' }).expect(200))).toEqual([]);
      expect(idsDe(await listar({ sedeId: sedeConRecepcion, email: emailRecepcion }).expect(200))).toEqual([recepcionId]);
      expect(idsDe(await listar({ sedeId: sedeSinRecepcion, email: emailRecepcion }).expect(200))).toEqual([]);
      expect(
        idsDe(
          await listar({ sedeId: sedeConRecepcion, rol: 'RECEPCION', nombre: 'Recepcion', email: emailRecepcion }).expect(200),
        ),
      ).toEqual([recepcionId]);
    });

    it('un usuario sin puesto de trabajo no aparece al filtrar por sede', async () => {
      const res = await listar({ sedeId: sedeConRecepcion, email: emailExterno }).expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it('pagina con total constante: la pagina 2 queda vacia', async () => {
      const p1 = await listar({ sedeId: sedeConRecepcion, page: 1, perPage: 1 }).expect(200);
      const p2 = await listar({ sedeId: sedeConRecepcion, page: 2, perPage: 1 }).expect(200);

      expect(idsDe(p1)).toEqual([recepcionId]);
      expect(p2.body.items).toEqual([]);
      expect([p1.body.total, p2.body.total]).toEqual([1, 1]);
    });

    it('422 problem+json por sedeId invalido o parametro fuera de la lista blanca', async () => {
      const invalidas: Record<string, string | number>[] = [
        { sedeId: 0 },
        { sedeId: -1 },
        { sedeId: 'abc' },
        { sedeId: '1.5' },
        { sedeOrigenId: 3 },
      ];

      for (const query of invalidas) {
        const res = await listar(query).expect(422);
        expect(res.headers['content-type'], JSON.stringify(query)).toContain('application/problem+json');
      }
    });

    // No regresion: sin sedeId el listado trae a todos, tambien a quienes no tienen puesto.
    it('sin sedeId sigue trayendo a todos los usuarios, con sedeId null para quien no tiene puesto', async () => {
      const externo = await listar({ email: emailExterno }).expect(200);
      expect(externo.body.items).toHaveLength(1);
      expect(externo.body.items[0]).toMatchObject({ id: externoId, sedeId: null });

      const recepcion = await listar({ email: emailRecepcion }).expect(200);
      expect(recepcion.body.items[0]).toMatchObject({ id: recepcionId, sedeId: sedeConRecepcion });

      const todos = await listar({ perPage: 100 }).expect(200);
      expect(todos.body.total).toBe(await prisma.usuario.count());
    });
  });
});
