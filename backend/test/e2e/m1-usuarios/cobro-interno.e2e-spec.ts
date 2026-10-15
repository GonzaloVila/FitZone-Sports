import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { PRECIOS_PLAN } from 'src/modules/m1-usuarios/entities/membresia.entity';
import { crearApp, dniUnico } from '@test/helpers/base-de-datos';
import { crearContextoM1 } from './m1.fixtures';

// Cobros INTERNOS de M1 (RF-02): el alta y el cambio de plan arman su token en el
// código, así que el mock de la pasarela (`PASARELA_MOCK`) fuerza RECHAZADO/PENDIENTE
// sin mirar el token. Es el cruce M1 -> M5 por el bus, que la integración no ve (M5
// no está cargado ahí). Incluye el camino APROBADO del cambio de plan en mora.
describe('M1 - Cobro interno de membresía (PASARELA_MOCK)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof crearContextoM1>>;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    ctx = await crearContextoM1(app, prisma);
  });

  afterEach(() => {
    delete process.env.PASARELA_MOCK;
  });

  afterAll(async () => {
    await ctx.limpiar();
    await app.close();
  });

  async function crearUsuario(nombre: string): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({ rol: 'EXTERNO', dni: dniUnico(), nombre, email: ctx.emailSocio(), contrasenia: 'clave12345' })
      .expect(201);
    return res.body.id;
  }

  it('RF-02: alta de socio rechazada -> 402, sin socio activo ni pago', async () => {
    const usuarioId = await crearUsuario('Alta Rechazada E2E');

    process.env.PASARELA_MOCK = 'RECHAZADO';

    await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuarioId, sedeOrigenId: ctx.sedeId, plan: 'MENSUAL' })
      .expect(402);

    expect(
      await prisma.pago.findFirst({ where: { usuario_id: usuarioId, idempotencia_key: { startsWith: 'alta-' } } }),
    ).toBeNull();
    expect(await prisma.socio.findFirst({ where: { usuario_id: usuarioId, activo: true } })).toBeNull();
    expect((await prisma.socio.findFirst({ where: { usuario_id: usuarioId } }))?.activo).toBe(false);
  });

  it('RF-02: alta de socio con cobro PENDIENTE -> 402 y sin socio activo', async () => {
    const usuarioId = await crearUsuario('Alta Pendiente E2E');

    process.env.PASARELA_MOCK = 'PENDIENTE';

    await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuarioId, sedeOrigenId: ctx.sedeId, plan: 'MENSUAL' })
      .expect(402);

    expect(await prisma.pago.findFirst({ where: { usuario_id: usuarioId } })).toBeNull();
    expect(await prisma.socio.findFirst({ where: { usuario_id: usuarioId, activo: true } })).toBeNull();
  });

  it('RF-02: cambio de plan rechazado -> 402 y la membresía no cambia', async () => {
    const usuarioId = await crearUsuario('Plan Rechazado E2E');
    const socioRes = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuarioId, sedeOrigenId: ctx.sedeId, plan: 'MENSUAL' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/socios/${socioRes.body.id}/membresias`)
      .send({ estado: 'SUSPENDIDA' })
      .expect(200);

    process.env.PASARELA_MOCK = 'RECHAZADO';

    await request(app.getHttpServer())
      .patch(`/api/v1/socios/${socioRes.body.id}/membresias`)
      .send({ plan: 'TRIMESTRAL' })
      .expect(402);

    expect((await prisma.membresia.findFirst({ where: { socio_id: socioRes.body.id } }))?.plan).toBe('MENSUAL');
    expect(
      await prisma.pago.findFirst({ where: { usuario_id: usuarioId, idempotencia_key: { startsWith: 'plan-' } } }),
    ).toBeNull();
  });

  it('RF-02: cambio de plan sobre membresía NO vigente cobra el plan nuevo vía evento', async () => {
    const usuarioId = await crearUsuario('Cambio Plan Mora E2E');
    const socioRes = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuarioId, sedeOrigenId: ctx.sedeId, plan: 'MENSUAL' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/socios/${socioRes.body.id}/membresias`)
      .send({ estado: 'SUSPENDIDA' })
      .expect(200);

    const resCambio = await request(app.getHttpServer())
      .patch(`/api/v1/socios/${socioRes.body.id}/membresias`)
      .send({ plan: 'TRIMESTRAL' })
      .expect(200);
    expect(resCambio.body.plan).toBe('TRIMESTRAL');

    const pago = await prisma.pago.findFirst({
      where: { usuario_id: usuarioId, idempotencia_key: { startsWith: 'plan-' } },
    });
    expect(pago).not.toBeNull();
    expect(pago!.estado).toBe('APROBADO');
    expect(pago!.monto.toNumber()).toBe(PRECIOS_PLAN.TRIMESTRAL);
  });
});
