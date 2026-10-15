import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp, dniUnico } from '@test/helpers/base-de-datos';
import { crearContextoM1 } from './m1.fixtures';

// E2E de socios: el flujo HTTP completo (usuario -> socio -> membresía -> baja) y el
// cruce RF-02 con M5 (el pago sobrevive a la baja). El alta/listado/filtros/errores y
// la baja/re-alta viven en la integración (test/integration/m1-usuarios).
describe('M1 - Socios', () => {
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

  async function crearUsuario(nombre: string, email: string): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({ rol: 'EXTERNO', dni: dniUnico(), nombre, email, contrasenia: 'clave12345' })
      .expect(201);
    return res.body.id;
  }

  it('flujo completo: usuario -> socio -> membresia -> baja (HTTP)', async () => {
    const emailDelSocio = ctx.emailSocio();
    const usuarioId = await crearUsuario('Socio E2E', emailDelSocio);

    const crearSocioRes = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuarioId, sedeOrigenId: ctx.sedeId, plan: 'MENSUAL' })
      .expect(201);
    const socioId: number = crearSocioRes.body.id;
    expect(crearSocioRes.headers.location).toBe(`/api/v1/socios/${socioId}`);
    expect(crearSocioRes.body).toMatchObject({ usuarioId, nombre: 'Socio E2E', email: emailDelSocio });

    const usuarioComoSocio = await request(app.getHttpServer()).get(`/api/v1/usuarios/${usuarioId}`).expect(200);
    expect(usuarioComoSocio.body.rol).toBe('SOCIO');

    const membresiaRes = await request(app.getHttpServer()).get(`/api/v1/socios/${socioId}/membresias`).expect(200);
    expect(membresiaRes.body.plan).toBe('MENSUAL');

    await request(app.getHttpServer()).delete(`/api/v1/socios/${socioId}`).expect(204);

    const usuarioFinal = await request(app.getHttpServer()).get(`/api/v1/usuarios/${usuarioId}`).expect(200);
    expect(usuarioFinal.body.rol).toBe('EXTERNO');
    await request(app.getHttpServer()).get(`/api/v1/socios/${socioId}/membresias`).expect(404);
  });

  it('RF-02: el pago de la membresía sobrevive a la baja del socio (historial)', async () => {
    const usuarioId = await crearUsuario('Pago Historial', ctx.emailSocio());

    const socio = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuarioId, sedeOrigenId: ctx.sedeId, plan: 'MENSUAL' })
      .expect(201);

    const pagoAntes = await prisma.pago.findFirst({
      where: { usuario_id: usuarioId, pago_membresia: { isNot: null } },
      include: { pago_membresia: true },
    });
    expect(pagoAntes).not.toBeNull();
    const pagoId = pagoAntes!.id;

    await request(app.getHttpServer()).delete(`/api/v1/socios/${socio.body.id}`).expect(204);

    const membresiaTrasBaja = await prisma.membresia.findFirst({ where: { socio_id: socio.body.id } });
    expect(membresiaTrasBaja?.estado).toBe('SUSPENDIDA');

    const pagoDespues = await prisma.pago.findUnique({ where: { id: pagoId }, include: { pago_membresia: true } });
    expect(pagoDespues).not.toBeNull();
    expect(pagoDespues!.pago_membresia?.membresia_id).toBe(membresiaTrasBaja!.id);

    await request(app.getHttpServer()).get(`/api/v1/pagos/${pagoId}/comprobante`).expect(200);
  });
});
