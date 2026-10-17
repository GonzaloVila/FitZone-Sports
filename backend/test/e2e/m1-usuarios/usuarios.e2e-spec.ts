import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp, dniUnico } from '@test/helpers/base-de-datos';
import { crearContextoM1 } from './m1.fixtures';

// E2E de usuarios: listado con filtros (y que `contrasenia` no viaje) y el PATCH que
// limpia telefono/foto con null. La validación de DTOs vive en los specs de DTO.
describe('M1 - Usuarios', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof crearContextoM1>>;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    ctx = await crearContextoM1(app, prisma);
  });

  afterAll(async () => {
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
});
