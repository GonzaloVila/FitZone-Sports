import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProblemFilter } from '../src/commons/filters/problem.filter';
import { PrismaService } from '../src/commons/database/prisma.service';
import { PRECIOS_PLAN } from '../src/modules/m1-usuarios/entities/membresia.entity';

// Flujo de M2: alta de sede -> ingreso (RF-04) -> aforo (RF-05) -> egreso ->
// casos de error (membresía inactiva 403, acceso duplicado y aforo lleno 409,
// egreso duplicado 409, sede/ingreso inexistente 404) -> listado de ingresos con
// filtros, paginación y el sync offline de RNF-01.
//
// Corre contra el Postgres local de .env.test. Para correrlo contra otra base
// hay que exportar FITZONE_E2E_ALLOW_REMOTE=1 (ver test/vitest.e2e.setup.ts).
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
        sede_origen_id: opts.sedeOrigenId,
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
        precio: PRECIOS_PLAN.MENSUAL,
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
      .send({ sede_id: sedeId, usuario_id: usuarioId, codigo_totp: '123456' })
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
      .send({ sede_id: sedeId, usuario_id: usuarioId, codigo_totp: '123456' })
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
      .send({ sede_id: sedeId, usuario_id: usuarioId, codigo_totp: '123456' })
      .expect(403);
  });

  it('POST /ingresos responde 404 si la sede no existe', async () => {
    const { usuarioId } = await crearSocioConMembresia({
      vigente: true,
      sedeOrigenId: sedesCreadas[0],
    });

    await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sede_id: 999999, usuario_id: usuarioId, codigo_totp: '123456' })
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
      .send({ sede_id: sedeId, usuario_id: socioA.usuarioId, codigo_totp: '123456' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sede_id: sedeId, usuario_id: socioB.usuarioId, codigo_totp: '123456' })
      .expect(409);
  });

  // Fase 3: cobertura de GET /ingresos y GET /ingresos/{ingreso_id}.
  //
  // Cada concern crea su PROPIA sede y filtra por ella. Asi los conteos son
  // exactos sin depender de quantas filas tenga la base: las pruebas dan el
  // mismo resultado contra fitzone_test (vacia) y contra la Supabase
  // compartida (que tiene 3 sedes, 3 ingresos y 4 clases de desarrollo).
  describe('GET /ingresos - listado con filtros', () => {
    async function crearSede(aforo: number): Promise<number> {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sedes')
        .send({ nombre: 'Sede E2E Listado', direccion: 'Calle Falsa 1234', aforo_maximo: aforo })
        .expect(201);
      sedesCreadas.push(res.body.id);
      return res.body.id as number;
    }

    it('GET /ingresos?sede_id= devuelve solo los ingresos de esa sede', async () => {
      const sedeId = await crearSede(10);
      const otraSedeId = await crearSede(10);
      const enEsta = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
      const enLaOtra = await crearSocioConMembresia({ vigente: true, sedeOrigenId: otraSedeId });

      const ingresoRes = await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({ sede_id: sedeId, usuario_id: enEsta.usuarioId, codigo_totp: '123456' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({ sede_id: otraSedeId, usuario_id: enLaOtra.usuarioId, codigo_totp: '123456' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/ingresos?sede_id=${sedeId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(ingresoRes.body.id);
      expect(res.body[0].sede_id).toBe(sedeId);
      // Hay un ingreso en la otra sede, asi que esto prueba que el filtro se
      // aplica de verdad y no que la lista venia vacia.
      expect(res.body.some((i: { id: number }) => i.id !== ingresoRes.body.id)).toBe(false);
    });

    it('GET /ingresos/{id} devuelve el registro y 404 si no existe', async () => {
      const sedeId = await crearSede(10);
      const { usuarioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      const ingresoRes = await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({ sede_id: sedeId, usuario_id: usuarioId, codigo_totp: '123456' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/ingresos/${ingresoRes.body.id}`)
        .expect(200);

      // Contrato IngresoOut: los 6 campos, sin mas ni menos.
      expect(Object.keys(res.body).sort()).toEqual([
        'fecha_hora_egreso',
        'fecha_hora_ingreso',
        'id',
        'sede_id',
        'usuario_id',
        'validado_offline',
      ]);
      expect(res.body.fecha_hora_egreso).toBeNull();
      expect(res.body.validado_offline).toBe(false);

      await request(app.getHttpServer()).get('/api/v1/ingresos/999999').expect(404);
    });

    it('filtro dentro=true trae solo los que siguen en la sede', async () => {
      const sedeId = await crearSede(10);
      const dentro = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
      const fuera = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      const ingresoDentroRes = await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({ sede_id: sedeId, usuario_id: dentro.usuarioId, codigo_totp: '123456' })
        .expect(201);
      const ingresoFueraRes = await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({ sede_id: sedeId, usuario_id: fuera.usuarioId, codigo_totp: '123456' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/ingresos/${ingresoFueraRes.body.id}/egreso`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/ingresos?sede_id=${sedeId}&dentro=true`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(ingresoDentroRes.body.id);

      // dentro=false no es lo inverso: el contrato solo define el caso true, asi
      // que false no debe filtrar (filtrar por false seria un NOT sobre null,
      // que en SQL no significa "tiene egreso").
      const sinFiltro = await request(app.getHttpServer())
        .get(`/api/v1/ingresos?sede_id=${sedeId}&dentro=false`)
        .expect(200);
      expect(sinFiltro.body).toHaveLength(2);
    });

    it('el filtro fecha usa el dia de la sede (-03:00), no el dia UTC', async () => {
      const sedeId = await crearSede(10);
      const { usuarioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      // 01:30 UTC del dia 15 son las 22:30 del dia 14 en Argentina. Si el filtro
      // usara UTC el ingreso caeria en el 15; con -03:00 tiene que caer en el 14.
      const ingresoRes = await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({
          sede_id: sedeId,
          usuario_id: usuarioId,
          codigo_totp: '123456',
          fecha_hora_ingreso: '2026-03-15T01:30:00.000Z',
        })
        .expect(201);

      const diaLocal = await request(app.getHttpServer())
        .get(`/api/v1/ingresos?sede_id=${sedeId}&fecha=2026-03-14`)
        .expect(200);
      expect(diaLocal.body).toHaveLength(1);
      expect(diaLocal.body[0].id).toBe(ingresoRes.body.id);

      const diaUtc = await request(app.getHttpServer())
        .get(`/api/v1/ingresos?sede_id=${sedeId}&fecha=2026-03-15`)
        .expect(200);
      expect(diaUtc.body).toHaveLength(0);
    });

    it('la paginacion no repite filas entre paginas', async () => {
      const sedeId = await crearSede(10);
      const esperados: number[] = [];

      for (let i = 0; i < 3; i++) {
        const { usuarioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
        const res = await request(app.getHttpServer())
          .post('/api/v1/ingresos')
          .send({ sede_id: sedeId, usuario_id: usuarioId, codigo_totp: '123456' })
          .expect(201);
        esperados.push(res.body.id);
      }

      const vistos: number[] = [];
      for (const page of [1, 2, 3]) {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/ingresos?sede_id=${sedeId}&per_page=1&page=${page}`)
          .expect(200);
        expect(res.body).toHaveLength(1);
        vistos.push(res.body[0].id);
      }

      // Cada pagina trae una fila distinta y entre las tres están las 3 creadas.
      expect(new Set(vistos).size).toBe(3);
      expect([...vistos].sort((a, b) => a - b)).toEqual([...esperados].sort((a, b) => a - b));
    });

    it('rechaza con 422 los filtros y la paginacion invalidos', async () => {
      const q = '/api/v1/ingresos';
      // per_page por encima del maximo del contrato
      await request(app.getHttpServer()).get(`${q}?per_page=500`).expect(422);
      // fecha como instante en vez de dia
      await request(app.getHttpServer()).get(`${q}?fecha=2026-03-15T01:30:00.000Z`).expect(422);
      // fecha en formato regional
      await request(app.getHttpServer()).get(`${q}?fecha=15-03-2026`).expect(422);
      // dentro con un valor que no es boolean: si se casteara con Boolean(),
      // "1" y "false" se volverian true y el filtro pasaria silenciosamente.
      await request(app.getHttpServer()).get(`${q}?dentro=1`).expect(422);
      await request(app.getHttpServer()).get(`${q}?dentro=quilmil`).expect(422);
      // paginacion en cero
      await request(app.getHttpServer()).get(`${q}?page=0`).expect(422);
    });

    it('RNF-01: el puesto offline reporta la hora real del acceso', async () => {
      const sedeId = await crearSede(10);
      const { usuarioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      const momentoReal = '2026-05-04T22:15:00.000Z';
      const res = await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({
          sede_id: sedeId,
          usuario_id: usuarioId,
          codigo_totp: '123456',
          fecha_hora_ingreso: momentoReal,
          validado_offline: true,
        })
        .expect(201);

      expect(res.body.validado_offline).toBe(true);
      // El instante enviado tiene que volver tal cual: el servidor no lo pisa.
      expect(new Date(res.body.fecha_hora_ingreso).toISOString()).toBe(momentoReal);

      const detalle = await request(app.getHttpServer())
        .get(`/api/v1/ingresos/${res.body.id}`)
        .expect(200);
      expect(detalle.body.validado_offline).toBe(true);
      expect(new Date(detalle.body.fecha_hora_ingreso).toISOString()).toBe(momentoReal);
    });
  });
});
