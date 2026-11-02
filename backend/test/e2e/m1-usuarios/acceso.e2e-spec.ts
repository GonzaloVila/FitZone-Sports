import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp, dniUnico } from '@test/helpers/base-de-datos';
import { conToken, crearSocioConSesion, crearUsuarioConSesion } from '@test/helpers/sesion';
import { crearContextoM1 } from './m1.fixtures';

// E2E del acceso a /usuarios, /socios y /socios/{socioId}/membresias: todo exige sesion; crear, listar, modificar y dar de
// baja es de RECEPCION y GERENTE (RECEPCION crea solo EXTERNO y modifica solo a SOCIO y EXTERNO); leer un usuario, un socio
// o una membresia es de dueño (SOCIO y EXTERNO solo lo propio, y lo ajeno es 404).
// Todos los emails llevan el prefijo `socio.` para que la limpieza del contexto M1 los borre.
describe('M1 - Usuarios, socios y membresías: sesión y alcance por rol', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof crearContextoM1>>;

  const usuariosConPuesto: number[] = [];
  let sedeExtraId: number;

  // Sesiones por rol.
  const token = {} as Record<'externo' | 'recepcion' | 'gerente', string>;
  let socioA: Awaited<ReturnType<typeof crearSocioConSesion>>;
  let socioB: Awaited<ReturnType<typeof crearSocioConSesion>>;
  let usuarioExterno: number;
  let usuarioRecepcion: number;
  let usuarioRecepcion2: number;
  let usuarioGerente: number;
  let usuarioGerente2: number;

  const http = () => request(app.getHttpServer());
  const alta = (rol: string, extra: Record<string, unknown> = {}) => ({
    rol,
    dni: dniUnico(),
    nombre: 'Alta E2E acceso',
    email: ctx.emailSocio(),
    contrasenia: 'clave12345',
    ...extra,
  });

  async function sesion(rol: 'EXTERNO' | 'RECEPCION' | 'GERENTE', tag: string) {
    return crearUsuarioConSesion(app, prisma, rol, `socio.${tag}`);
  }

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    ctx = await crearContextoM1(app, prisma);
    sedeExtraId = (await prisma.sede.create({ data: { nombre: 'Sede E2E acceso M1', direccion: 'Calle 1', aforo_maximo: 5 } })).id;

    socioA = await crearSocioConSesion(app, prisma, ctx.sedeId, 'socio.a');
    socioB = await crearSocioConSesion(app, prisma, ctx.sedeId, 'socio.b');
    const externo = await sesion('EXTERNO', 'externo');
    const recepcion = await sesion('RECEPCION', 'recepcion');
    const gerente = await sesion('GERENTE', 'gerente');
    token.externo = externo.token;
    token.recepcion = recepcion.token;
    token.gerente = gerente.token;
    usuarioExterno = externo.usuarioId;
    usuarioRecepcion = recepcion.usuarioId;
    usuarioGerente = gerente.usuarioId;
    usuarioRecepcion2 = (await sesion('RECEPCION', 'recepcion2')).usuarioId;
    usuarioGerente2 = (await sesion('GERENTE', 'gerente2')).usuarioId;
  });

  afterAll(async () => {
    await prisma.empleadoSede.deleteMany({ where: { usuario_id: { in: usuariosConPuesto } } });
    await prisma.sede.delete({ where: { id: sedeExtraId } });
    await ctx.limpiar();
    await app.close();
  });

  it('sin token los once endpoints cerrados responden 401', async () => {
    const { socioId } = socioA;
    await http().post('/api/v1/usuarios').send(alta('EXTERNO')).expect(401);
    await http().get('/api/v1/usuarios').expect(401);
    await http().get(`/api/v1/usuarios/${usuarioExterno}`).expect(401);
    await http().patch(`/api/v1/usuarios/${usuarioExterno}`).send({ nombre: 'Sin sesion' }).expect(401);
    await http().post('/api/v1/socios').send({ usuarioId: usuarioExterno, sedeOrigenId: ctx.sedeId, plan: 'MENSUAL' }).expect(401);
    await http().get('/api/v1/socios').expect(401);
    await http().get(`/api/v1/socios/${socioId}`).expect(401);
    await http().patch(`/api/v1/socios/${socioId}`).send({ sedeOrigenId: ctx.sedeId }).expect(401);
    await http().delete(`/api/v1/socios/${socioId}`).expect(401);
    await http().get(`/api/v1/socios/${socioId}/membresias`).expect(401);
    await http().patch(`/api/v1/socios/${socioId}/membresias`).send({ renuevaAutomatica: false }).expect(401);

    const intacto = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioExterno } });
    expect(intacto.nombre).not.toBe('Sin sesion');
    expect((await prisma.socio.findUniqueOrThrow({ where: { id: socioId } })).activo).toBe(true);
  });

  describe('SOCIO y EXTERNO: 403 en todo lo de RECEPCION y GERENTE', () => {
    it('no pueden crear, listar, modificar ni dar de baja, y nada cambia', async () => {
      const { socioId } = socioA;
      for (const t of [socioA.token, token.externo]) {
        await http().post('/api/v1/usuarios').set(conToken(t)).send(alta('EXTERNO')).expect(403);
        await http().get('/api/v1/usuarios').set(conToken(t)).expect(403);
        await http()
          .post('/api/v1/socios')
          .set(conToken(t))
          .send({ usuarioId: usuarioExterno, sedeOrigenId: ctx.sedeId, plan: 'MENSUAL' })
          .expect(403);
        await http().get('/api/v1/socios').set(conToken(t)).expect(403);
        await http().patch(`/api/v1/socios/${socioId}`).set(conToken(t)).send({ sedeOrigenId: ctx.sedeId }).expect(403);
        await http().delete(`/api/v1/socios/${socioId}`).set(conToken(t)).expect(403);
        await http().patch(`/api/v1/socios/${socioId}/membresias`).set(conToken(t)).send({ renuevaAutomatica: true }).expect(403);
      }

      expect((await prisma.socio.findUniqueOrThrow({ where: { id: socioId } })).activo).toBe(true);
      expect((await prisma.membresia.findFirstOrThrow({ where: { socio_id: socioId } })).renueva_automatica).toBe(false);
      expect(await prisma.socio.count({ where: { usuario_id: usuarioExterno } })).toBe(0);
    });

    it('tampoco modifican su propio usuario ni el de otro: 403 y el nombre queda igual', async () => {
      const antes = await prisma.usuario.findUniqueOrThrow({ where: { id: socioA.usuarioId } });

      await http().patch(`/api/v1/usuarios/${socioA.usuarioId}`).set(conToken(socioA.token)).send({ nombre: 'Yo mismo' }).expect(403);
      await http().patch(`/api/v1/usuarios/${usuarioExterno}`).set(conToken(token.externo)).send({ nombre: 'Yo mismo' }).expect(403);
      await http().patch(`/api/v1/usuarios/${usuarioExterno}`).set(conToken(socioA.token)).send({ nombre: 'Otro' }).expect(403);

      const despues = await prisma.usuario.findUniqueOrThrow({ where: { id: socioA.usuarioId } });
      expect(despues.nombre).toBe(antes.nombre);
      expect((await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioExterno } })).nombre).not.toBe('Yo mismo');
    });
  });

  describe('POST /usuarios: qué rol crea qué', () => {
    it('RECEPCION crea un EXTERNO (201) pero no un RECEPCION ni un GERENTE (403, y no se crea nada)', async () => {
      await http().post('/api/v1/usuarios').set(conToken(token.recepcion)).send(alta('EXTERNO')).expect(201);

      for (const rol of ['RECEPCION', 'GERENTE']) {
        const email = ctx.emailSocio();
        const extra = rol === 'RECEPCION' ? { sedeId: sedeExtraId } : {};
        const res = await http().post('/api/v1/usuarios').set(conToken(token.recepcion)).send(alta(rol, { email, ...extra })).expect(403);

        expect(res.headers['content-type']).toContain('application/problem+json');
        expect(await prisma.usuario.findUnique({ where: { email } })).toBeNull();
      }
    });

    it('GERENTE crea EXTERNO, GERENTE y RECEPCION (con su sede)', async () => {
      await http().post('/api/v1/usuarios').set(conToken(token.gerente)).send(alta('EXTERNO')).expect(201);
      await http().post('/api/v1/usuarios').set(conToken(token.gerente)).send(alta('GERENTE')).expect(201);
      const recepcion = await http()
        .post('/api/v1/usuarios')
        .set(conToken(token.gerente))
        .send(alta('RECEPCION', { sedeId: sedeExtraId }))
        .expect(201);
      usuariosConPuesto.push(recepcion.body.id);
    });
  });

  describe('PATCH /usuarios/{id}: a quién modifica cada rol', () => {
    const cambio = (nombre: string) => ({ nombre });

    it('RECEPCION modifica a un SOCIO y a un EXTERNO', async () => {
      await http().patch(`/api/v1/usuarios/${socioB.usuarioId}`).set(conToken(token.recepcion)).send(cambio('Socio editado')).expect(200);
      const res = await http().patch(`/api/v1/usuarios/${usuarioExterno}`).set(conToken(token.recepcion)).send(cambio('Externo editado')).expect(200);

      expect(res.body.nombre).toBe('Externo editado');
    });

    it('RECEPCION recibe 403 sobre un RECEPCION, un GERENTE y sobre sí mismo, sin modificar nada', async () => {
      for (const id of [usuarioRecepcion2, usuarioGerente2, usuarioRecepcion]) {
        await http().patch(`/api/v1/usuarios/${id}`).set(conToken(token.recepcion)).send(cambio('Prohibido')).expect(403);
        expect((await prisma.usuario.findUniqueOrThrow({ where: { id } })).nombre).not.toBe('Prohibido');
      }
    });

    it('un usuario inexistente es 404 también para RECEPCION', async () => {
      await http().patch('/api/v1/usuarios/2000000').set(conToken(token.recepcion)).send(cambio('X')).expect(404);
      await http().patch('/api/v1/usuarios/2000000').set(conToken(token.gerente)).send(cambio('X')).expect(404);
    });

    it('GERENTE modifica a cualquiera: SOCIO, EXTERNO, RECEPCION y GERENTE', async () => {
      for (const id of [socioB.usuarioId, usuarioExterno, usuarioRecepcion2, usuarioGerente2, usuarioGerente]) {
        const res = await http().patch(`/api/v1/usuarios/${id}`).set(conToken(token.gerente)).send(cambio('Editado por G')).expect(200);
        expect(res.body.nombre).toBe('Editado por G');
      }
    });
  });

  describe('GET /usuarios y GET /usuarios/{id}', () => {
    it('RECEPCION y GERENTE listan usuarios', async () => {
      await http().get('/api/v1/usuarios').set(conToken(token.recepcion)).expect(200);
      await http().get('/api/v1/usuarios').set(conToken(token.gerente)).expect(200);
    });

    it('SOCIO y EXTERNO ven el propio; otro es 404 con el texto de "no existe"', async () => {
      const propioSocio = await http().get(`/api/v1/usuarios/${socioA.usuarioId}`).set(conToken(socioA.token)).expect(200);
      expect(propioSocio.body.id).toBe(socioA.usuarioId);
      await http().get(`/api/v1/usuarios/${usuarioExterno}`).set(conToken(token.externo)).expect(200);

      for (const [t, ajeno] of [
        [socioA.token, socioB.usuarioId],
        [token.externo, socioA.usuarioId],
      ] as const) {
        const res = await http().get(`/api/v1/usuarios/${ajeno}`).set(conToken(t)).expect(404);
        expect(res.body.detail).toBe('No existe el recurso solicitado para el id indicado.');
      }
    });

    it('RECEPCION y GERENTE ven cualquiera', async () => {
      for (const t of [token.recepcion, token.gerente]) {
        await http().get(`/api/v1/usuarios/${socioA.usuarioId}`).set(conToken(t)).expect(200);
        await http().get(`/api/v1/usuarios/${usuarioGerente}`).set(conToken(t)).expect(200);
      }
    });
  });

  describe('GET /socios/{socioId} y GET /socios/{socioId}/membresias', () => {
    it('el SOCIO ve su socio y su membresía; los de otro socio son 404', async () => {
      const propio = await http().get(`/api/v1/socios/${socioA.socioId}`).set(conToken(socioA.token)).expect(200);
      expect(propio.body.id).toBe(socioA.socioId);
      await http().get(`/api/v1/socios/${socioA.socioId}/membresias`).set(conToken(socioA.token)).expect(200);

      const socioAjeno = await http().get(`/api/v1/socios/${socioB.socioId}`).set(conToken(socioA.token)).expect(404);
      expect(socioAjeno.body.detail).toBe('No existe el recurso solicitado para el id indicado.');
      const membresiaAjena = await http()
        .get(`/api/v1/socios/${socioB.socioId}/membresias`)
        .set(conToken(socioA.token))
        .expect(404);
      expect(membresiaAjena.body.detail).toBe('No existe el socio indicado.');
    });

    it('el EXTERNO recibe 404 con cualquier socio', async () => {
      await http().get(`/api/v1/socios/${socioA.socioId}`).set(conToken(token.externo)).expect(404);
      await http().get(`/api/v1/socios/${socioA.socioId}/membresias`).set(conToken(token.externo)).expect(404);
    });

    it('RECEPCION y GERENTE ven cualquiera', async () => {
      for (const t of [token.recepcion, token.gerente]) {
        await http().get(`/api/v1/socios/${socioB.socioId}`).set(conToken(t)).expect(200);
        await http().get(`/api/v1/socios/${socioB.socioId}/membresias`).set(conToken(t)).expect(200);
      }
    });
  });

  describe('RECEPCION y GERENTE operan sobre socios y membresías', () => {
    it('listan, modifican el socio y la membresía', async () => {
      for (const t of [token.recepcion, token.gerente]) {
        await http().get('/api/v1/socios').set(conToken(t)).expect(200);
        await http().patch(`/api/v1/socios/${socioB.socioId}`).set(conToken(t)).send({ sedeOrigenId: ctx.sedeId }).expect(200);
        const res = await http()
          .patch(`/api/v1/socios/${socioB.socioId}/membresias`)
          .set(conToken(t))
          .send({ renuevaAutomatica: false })
          .expect(200);
        expect(res.body.renuevaAutomatica).toBe(false);
      }
    });

    it('dan de alta un socio (201) y de baja (204)', async () => {
      for (const t of [token.recepcion, token.gerente]) {
        const usuario = await http().post('/api/v1/usuarios').set(conToken(t)).send(alta('EXTERNO')).expect(201);
        const socio = await http()
          .post('/api/v1/socios')
          .set(conToken(t))
          .send({ usuarioId: usuario.body.id, sedeOrigenId: ctx.sedeId, plan: 'MENSUAL' })
          .expect(201);

        await http().delete(`/api/v1/socios/${socio.body.id}`).set(conToken(t)).expect(204);
      }
    });
  });
});
