import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProblemFilter } from '../src/commons/filters/problem.filter';
import { PrismaService } from '../src/commons/database/prisma.service';

// Flujo de M2: alta de sede -> ingreso (RF-04) -> aforo (RF-05) -> egreso ->
// casos de error (membresía inactiva 403, acceso duplicado y aforo lleno 409,
// egreso duplicado 409, sede/ingreso inexistente 404). Corre contra la base
// de test levantada con docker-compose.test.yml (ver docs/TESTING.md).
//
// El socio y su membresía ACTIVA se siembran directo con Prisma en beforeAll
// (M1 no expone un flujo HTTP más corto para esto en un solo paso).

describe('M2 - Sedes / Ingresos / Aforo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];
  const sedesCreadas: number[] = [];

  const emailUnico = () => `m2.${Date.now()}.${Math.floor(Math.random() * 1000)}@e2e.fitzone.test`;
  const dniUnico = () => String(10000000 + Math.floor(Math.random() * 89999999));

  async function crearSocioConMembresia(opts: { vigente: boolean; sedeOrigenId: number }) {
    const usuario = await prisma.usuario.create({
      data: {
        rol: 'SOCIO',
        dni: dniUnico(),
        nombre: 'Socio E2E M2',
        email: emailUnico(),
        contrasenia: 'hash-no-relevante',
      },
    });
    usuariosCreados.push(usuario.id);

    const socio = await prisma.socio.create({
      data: {
        usuario_id: usuario.id,
        sede_id: opts.sedeOrigenId,
        fecha_alta: new Date(),
      },
    });
    sociosCreados.push(socio.id);

    const ahora = new Date();
    const fechaFin = new Date(ahora);
    fechaFin.setDate(fechaFin.getDate() + (opts.vigente ? 30 : -1));

    await prisma.membresia.create({
      data: {
        socio_id: socio.id,
        plan: 'MENSUAL',
        estado: 'ACTIVA',
        fecha_inicio: ahora,
        fecha_fin: fechaFin,
        renueva_automatica: false,
      },
    });

    return { usuarioId: usuario.id, socioId: socio.id };
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new ProblemFilter());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Limpieza en orden inverso a las FKs (ingreso -> membresia -> socio -> usuario -> sede).
    await prisma.ingreso.deleteMany({ where: { usuario_id: { in: usuariosCreados } } });
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.deleteMany({ where: { id: { in: sedesCreadas } } });
    await app.close();
  });

  it('POST /sedes crea una sede y GET /sedes la lista', async () => {
    const crearRes = await request(app.getHttpServer())
      .post('/api/v1/sedes')
      .send({ nombre: 'Sede E2E M2', direccion: 'Calle Falsa 123', aforo_maximo: 5 })
      .expect(201);

    expect(crearRes.headers.location).toBe(`/api/v1/sedes/${crearRes.body.id}`);
    sedesCreadas.push(crearRes.body.id);

    const listarRes = await request(app.getHttpServer()).get('/api/v1/sedes').expect(200);
    expect(Array.isArray(listarRes.body)).toBe(true);
    expect(listarRes.body.some((s: { id: number }) => s.id === crearRes.body.id)).toBe(true);
  });

  it('POST /sedes responde 422 si faltan campos obligatorios', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sedes')
      .send({ nombre: 'Sede incompleta' })
      .expect(422);
  });

  it('flujo completo: ingreso -> aforo -> egreso -> aforo liberado', async () => {
    const sedeRes = await request(app.getHttpServer())
      .post('/api/v1/sedes')
      .send({ nombre: 'Sede E2E Flujo', direccion: 'Calle Falsa 456', aforo_maximo: 5 })
      .expect(201);
    const sedeId: number = sedeRes.body.id;
    sedesCreadas.push(sedeId);

    const { usuarioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

    const ingresoRes = await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sede_id: sedeId, usuario_id: usuarioId, qr_token: 'qr-e2e-test' })
      .expect(201);
    const ingresoId: number = ingresoRes.body.id;
    expect(ingresoRes.headers.location).toBe(`/api/v1/ingresos/${ingresoId}`);
    expect(ingresoRes.body.fecha_hora_egreso).toBeNull();

    const aforoOcupadoRes = await request(app.getHttpServer())
      .get(`/api/v1/sedes/${sedeId}/aforo`)
      .expect(200);
    expect(aforoOcupadoRes.body.aforo_actual).toBe(1);
    expect(aforoOcupadoRes.body.restante).toBe(4);

    // RN-01: mismo usuario no puede tener dos ingresos abiertos a la vez
    await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sede_id: sedeId, usuario_id: usuarioId, qr_token: 'qr-e2e-test-2' })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/ingresos/${ingresoId}/egreso`)
      .expect(204);

    // Egresar dos veces el mismo ingreso responde 409
    await request(app.getHttpServer())
      .post(`/api/v1/ingresos/${ingresoId}/egreso`)
      .expect(409);

    const aforoLiberadoRes = await request(app.getHttpServer())
      .get(`/api/v1/sedes/${sedeId}/aforo`)
      .expect(200);
    expect(aforoLiberadoRes.body.aforo_actual).toBe(0);
    expect(aforoLiberadoRes.body.restante).toBe(5);
  });

  it('POST /ingresos responde 403 si la membresía no está vigente', async () => {
    const sedeRes = await request(app.getHttpServer())
      .post('/api/v1/sedes')
      .send({ nombre: 'Sede E2E Vencida', direccion: 'Calle Falsa 789', aforo_maximo: 5 })
      .expect(201);
    const sedeId: number = sedeRes.body.id;
    sedesCreadas.push(sedeId);

    const { usuarioId } = await crearSocioConMembresia({ vigente: false, sedeOrigenId: sedeId });

    await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sede_id: sedeId, usuario_id: usuarioId, qr_token: 'qr-e2e-vencida' })
      .expect(403);
  });

  it('POST /ingresos responde 404 si la sede no existe', async () => {
    const { usuarioId } = await crearSocioConMembresia({
      vigente: true,
      sedeOrigenId: sedesCreadas[0],
    });

    await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sede_id: 999999, usuario_id: usuarioId, qr_token: 'qr-e2e-404' })
      .expect(404);
  });

  it('POST /ingresos/{id}/egreso responde 404 si el ingreso no existe', async () => {
    await request(app.getHttpServer()).post('/api/v1/ingresos/999999/egreso').expect(404);
  });

  it('GET /sedes/{id}/aforo responde 404 si la sede no existe', async () => {
    await request(app.getHttpServer()).get('/api/v1/sedes/999999/aforo').expect(404);
  });

  it('POST /ingresos responde 409 (aforo-lleno) cuando la sede llega a su capacidad', async () => {
    const sedeRes = await request(app.getHttpServer())
      .post('/api/v1/sedes')
      .send({ nombre: 'Sede E2E Aforo 1', direccion: 'Calle Falsa 999', aforo_maximo: 1 })
      .expect(201);
    const sedeId: number = sedeRes.body.id;
    sedesCreadas.push(sedeId);

    const socioA = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
    const socioB = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

    await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sede_id: sedeId, usuario_id: socioA.usuarioId, qr_token: 'qr-e2e-aforo-a' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sede_id: sedeId, usuario_id: socioB.usuarioId, qr_token: 'qr-e2e-aforo-b' })
      .expect(409);
  });
});
