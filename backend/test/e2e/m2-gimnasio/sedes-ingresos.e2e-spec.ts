import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { PRECIOS_PLAN } from 'src/modules/m1-usuarios/entities/membresia.entity';
import { crearApp, dniUnico, emailUnico } from '@test/helpers/base-de-datos';

// E2E de M2: solo el contrato HTTP del flujo ingreso/aforo/egreso y el scope por sede
// del RECEPCION (JWT -> sede). El resto (RN-01, aforo lleno, 403 no vigente, sync) lo
// cubre la integración (ingresos.service.integration-spec.ts).
describe('M2 - Ingresos / Aforo: contrato HTTP y scope por sede', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];
  const sedesCreadas: number[] = [];
  const tokensPorSede = new Map<number, string>();

  async function tokenRecepcion(sedeId: number): Promise<string> {
    const cache = tokensPorSede.get(sedeId);
    if (cache) return cache;

    const email = emailUnico('m2.recep');
    // El alta de RECEPCION lleva la sede de trabajo (EmpleadoSede) desde POST
    // /usuarios: ya no hace falta insertar la fila a mano.
    const crearRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'RECEPCION',
        dni: dniUnico(),
        nombre: 'Recep E2E M2',
        email,
        contrasenia: 'clave12345',
        sedeId,
      })
      .expect(201);
    usuariosCreados.push(crearRes.body.id);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, contrasenia: 'clave12345' })
      .expect(200);
    const token = loginRes.body.accessToken as string;
    tokensPorSede.set(sedeId, token);
    return token;
  }

  async function crearSede(aforo: number): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sedes')
      .send({ nombre: 'Sede E2E M2', direccion: 'Calle Falsa 123', aforoMaximo: aforo })
      .expect(201);
    sedesCreadas.push(res.body.id);
    return res.body.id as number;
  }

  async function crearSocioConMembresia(sedeId: number): Promise<number> {
    const usuario = await prisma.usuario.create({
      data: { rol: 'SOCIO', dni: dniUnico(), nombre: 'Socio E2E M2', email: emailUnico('m2.socio'), contrasenia: 'hash' },
    });
    usuariosCreados.push(usuario.id);
    const socio = await prisma.socio.create({
      data: { usuario_id: usuario.id, sede_origen_id: sedeId, fecha_alta: new Date() },
    });
    sociosCreados.push(socio.id);
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
    return socio.id;
  }

  function ingresar(sedeId: number, socioId: number) {
    return request(app.getHttpServer()).post('/api/v1/ingresos').send({ sedeId, socioId, codigoTotp: '123456' });
  }

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
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

  it('flujo HTTP: ingreso 201+Location -> aforo -> egreso 204 -> aforo liberado', async () => {
    const sedeId = await crearSede(5);
    const socioId = await crearSocioConMembresia(sedeId);

    const ingresoRes = await ingresar(sedeId, socioId).expect(201);
    const ingresoId: number = ingresoRes.body.id;
    expect(ingresoRes.headers.location).toBe(`/api/v1/ingresos/${ingresoId}`);

    const ocupado = await request(app.getHttpServer()).get(`/api/v1/sedes/${sedeId}/aforo`).expect(200);
    expect(ocupado.body).toMatchObject({ aforoActual: 1, restante: 4 });

    const token = await tokenRecepcion(sedeId);
    await request(app.getHttpServer())
      .post(`/api/v1/ingresos/${ingresoId}/egreso`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const liberado = await request(app.getHttpServer()).get(`/api/v1/sedes/${sedeId}/aforo`).expect(200);
    expect(liberado.body).toMatchObject({ aforoActual: 0, restante: 5 });
  });

  it('RECEPCION solo ve/egresa su sede: el query no la overridea y egresar otra sede da 403', async () => {
    const sedeA = await crearSede(10);
    const sedeB = await crearSede(10);
    const ingresoA = (await ingresar(sedeA, await crearSocioConMembresia(sedeA)).expect(201)).body.id as number;
    const ingresoB = (await ingresar(sedeB, await crearSocioConMembresia(sedeB)).expect(201)).body.id as number;

    const tokenA = await tokenRecepcion(sedeA);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/ingresos?sedeId=${sedeB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(ingresoA);
    expect(res.body.total).toBe(1);

    await request(app.getHttpServer())
      .post(`/api/v1/ingresos/${ingresoB}/egreso`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
  });
});
