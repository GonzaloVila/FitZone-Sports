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
  const tokensPorSede = new Map<number, string>();

  const emailUnico = () => `m2.${Date.now()}.${Math.floor(Math.random() * 1000)}@e2e.fitzone.test`;
  const dniUnico = () => String(10000000 + Math.floor(Math.random() * 89999999));

  // Crea (una sola vez por sede) un usuario RECEPCION con su EmpleadoSede en esa
  // sede y hace login. Devuelve el JWT, que ya trae el sedeId en el payload.
  // GET /ingresos y el egreso están protegidos y el RECEPCION solo ve/egresa su
  // sede, así que cada test que los usa necesita el token de su propia sede.
  async function tokenRecepcion(sedeId: number): Promise<string> {
    const cache = tokensPorSede.get(sedeId);
    if (cache) return cache;

    const email = emailUnico();
    const crearRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'RECEPCION',
        dni: dniUnico(),
        nombre: 'Recep E2E M2',
        email,
        contrasenia: 'clave12345',
      })
      .expect(201);
    usuariosCreados.push(crearRes.body.id);

    await prisma.empleadoSede.create({
      data: { usuario_id: crearRes.body.id, sede_id: sedeId },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, contrasenia: 'clave12345' })
      .expect(200);
    const token = loginRes.body.accessToken as string;
    tokensPorSede.set(sedeId, token);
    return token;
  }

  async function crearSocioConMembresia(opts: {
    vigente: boolean;
    sedeOrigenId: number;
    nombre?: string;
  }) {
    const usuario = await prisma.usuario.create({
      data: {
        rol: 'SOCIO',
        dni: dniUnico(),
        nombre: opts.nombre ?? 'Socio E2E M2',
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
    // Limpieza en orden inverso a las FKs (ingreso -> membresia -> socio -> empleado -> usuario -> sede).
    await prisma.ingreso.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.empleadoSede.deleteMany({ where: { usuario_id: { in: usuariosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.deleteMany({ where: { id: { in: sedesCreadas } } });
    await app.close();
  });

  it('POST /sedes crea una sede y GET /sedes la lista', async () => {
    const crearRes = await request(app.getHttpServer())
      .post('/api/v1/sedes')
      .send({ nombre: 'Sede E2E M2', direccion: 'Calle Falsa 123', aforoMaximo: 5 })
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
      .send({ nombre: 'Sede E2E Flujo', direccion: 'Calle Falsa 456', aforoMaximo: 5 })
      .expect(201);
    const sedeId: number = sedeRes.body.id;
    sedesCreadas.push(sedeId);

    const { socioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

    const ingresoRes = await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sedeId: sedeId, socioId: socioId, codigoTotp: '123456' })
      .expect(201);
    const ingresoId: number = ingresoRes.body.id;
    expect(ingresoRes.headers.location).toBe(`/api/v1/ingresos/${ingresoId}`);
    expect(ingresoRes.body.fechaHoraEgreso).toBeNull();

    const aforoOcupadoRes = await request(app.getHttpServer())
      .get(`/api/v1/sedes/${sedeId}/aforo`)
      .expect(200);
    expect(aforoOcupadoRes.body.aforoActual).toBe(1);
    expect(aforoOcupadoRes.body.restante).toBe(4);

    // RN-01: mismo usuario no puede tener dos ingresos abiertos a la vez
    await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sedeId: sedeId, socioId: socioId, codigoTotp: '123456' })
      .expect(409);

    const token = await tokenRecepcion(sedeId);
    await request(app.getHttpServer())
      .post(`/api/v1/ingresos/${ingresoId}/egreso`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    // Egresar dos veces el mismo ingreso responde 409
    await request(app.getHttpServer())
      .post(`/api/v1/ingresos/${ingresoId}/egreso`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    const aforoLiberadoRes = await request(app.getHttpServer())
      .get(`/api/v1/sedes/${sedeId}/aforo`)
      .expect(200);
    expect(aforoLiberadoRes.body.aforoActual).toBe(0);
    expect(aforoLiberadoRes.body.restante).toBe(5);
  });

  it('POST /ingresos responde 403 si la membresía no está vigente', async () => {
    const sedeRes = await request(app.getHttpServer())
      .post('/api/v1/sedes')
      .send({ nombre: 'Sede E2E Vencida', direccion: 'Calle Falsa 789', aforoMaximo: 5 })
      .expect(201);
    const sedeId: number = sedeRes.body.id;
    sedesCreadas.push(sedeId);

    const { socioId } = await crearSocioConMembresia({ vigente: false, sedeOrigenId: sedeId });

    await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sedeId: sedeId, socioId: socioId, codigoTotp: '123456' })
      .expect(403);
  });

  it('POST /ingresos responde 404 si la sede no existe', async () => {
    const { socioId } = await crearSocioConMembresia({
      vigente: true,
      sedeOrigenId: sedesCreadas[0],
    });

    await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sedeId: 999999, socioId: socioId, codigoTotp: '123456' })
      .expect(404);
  });

  it('POST /ingresos/{id}/egreso responde 404 si el ingreso no existe', async () => {
    const token = await tokenRecepcion(sedesCreadas[0]);
    await request(app.getHttpServer())
      .post('/api/v1/ingresos/999999/egreso')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /sedes/{id}/aforo responde 404 si la sede no existe', async () => {
    await request(app.getHttpServer()).get('/api/v1/sedes/999999/aforo').expect(404);
  });

  it('POST /ingresos responde 409 (aforo-lleno) cuando la sede llega a su capacidad', async () => {
    const sedeRes = await request(app.getHttpServer())
      .post('/api/v1/sedes')
      .send({ nombre: 'Sede E2E Aforo 1', direccion: 'Calle Falsa 999', aforoMaximo: 1 })
      .expect(201);
    const sedeId: number = sedeRes.body.id;
    sedesCreadas.push(sedeId);

    const socioA = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
    const socioB = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

    await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sedeId: sedeId, socioId: socioA.socioId, codigoTotp: '123456' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sedeId: sedeId, socioId: socioB.socioId, codigoTotp: '123456' })
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
        .send({ nombre: 'Sede E2E Listado', direccion: 'Calle Falsa 1234', aforoMaximo: aforo })
        .expect(201);
      sedesCreadas.push(res.body.id);
      return res.body.id as number;
    }

    it('GET /ingresos?sedeId= devuelve solo los ingresos de esa sede', async () => {
      const sedeId = await crearSede(10);
      const otraSedeId = await crearSede(10);
      const enEsta = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
      const enLaOtra = await crearSocioConMembresia({ vigente: true, sedeOrigenId: otraSedeId });

      const ingresoRes = await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({ sedeId: sedeId, socioId: enEsta.socioId, codigoTotp: '123456' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({ sedeId: otraSedeId, socioId: enLaOtra.socioId, codigoTotp: '123456' })
        .expect(201);

      const token = await tokenRecepcion(sedeId);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/ingresos?sedeId=${sedeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(ingresoRes.body.id);
      expect(res.body[0].sedeId).toBe(sedeId);
      // Hay un ingreso en la otra sede, asi que esto prueba que el filtro se
      // aplica de verdad y no que la lista venia vacia.
      expect(res.body.some((i: { id: number }) => i.id !== ingresoRes.body.id)).toBe(false);
    });

    it('GET /ingresos/{id} devuelve el registro y 404 si no existe', async () => {
      const sedeId = await crearSede(10);
      const { socioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      const ingresoRes = await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({ sedeId: sedeId, socioId: socioId, codigoTotp: '123456' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/ingresos/${ingresoRes.body.id}`)
        .expect(200);

      // Contrato IngresoOut: los 8 campos (nombre y dni vienen del join a Usuario).
      expect(Object.keys(res.body).sort()).toEqual([
        'dni',
        'fechaHoraEgreso',
        'fechaHoraIngreso',
        'id',
        'nombre',
        'sedeId',
        'socioId',
        'validadoOffline',
      ]);
      expect(res.body.nombre).toBe('Socio E2E M2');
      expect(res.body.dni).toBeTruthy();
      expect(res.body.fechaHoraEgreso).toBeNull();
      expect(res.body.validadoOffline).toBe(false);

      await request(app.getHttpServer()).get('/api/v1/ingresos/999999').expect(404);
    });

    it('filtro dentro=true trae solo los que siguen en la sede', async () => {
      const sedeId = await crearSede(10);
      const dentro = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
      const fuera = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      const ingresoDentroRes = await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({ sedeId: sedeId, socioId: dentro.socioId, codigoTotp: '123456' })
        .expect(201);
      const ingresoFueraRes = await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({ sedeId: sedeId, socioId: fuera.socioId, codigoTotp: '123456' })
        .expect(201);

      const token = await tokenRecepcion(sedeId);
      await request(app.getHttpServer())
        .post(`/api/v1/ingresos/${ingresoFueraRes.body.id}/egreso`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/ingresos?sedeId=${sedeId}&dentro=true`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(ingresoDentroRes.body.id);

      // dentro=false no es lo inverso: el contrato solo define el caso true, asi
      // que false no debe filtrar (filtrar por false seria un NOT sobre null,
      // que en SQL no significa "tiene egreso").
      const sinFiltro = await request(app.getHttpServer())
        .get(`/api/v1/ingresos?sedeId=${sedeId}&dentro=false`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(sinFiltro.body).toHaveLength(2);
    });

    it('el filtro fecha usa el dia de la sede (-03:00), no el dia UTC', async () => {
      const sedeId = await crearSede(10);
      const { socioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      // 01:30 UTC del dia 15 son las 22:30 del dia 14 en Argentina. Si el filtro
      // usara UTC el ingreso caeria en el 15; con -03:00 tiene que caer en el 14.
      const ingresoRes = await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({
          sedeId: sedeId,
          socioId: socioId,
          codigoTotp: '123456',
          fechaHoraIngreso: '2026-03-15T01:30:00.000Z',
        })
        .expect(201);

      const token = await tokenRecepcion(sedeId);
      const diaLocal = await request(app.getHttpServer())
        .get(`/api/v1/ingresos?sedeId=${sedeId}&fecha=2026-03-14`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(diaLocal.body).toHaveLength(1);
      expect(diaLocal.body[0].id).toBe(ingresoRes.body.id);

      const diaUtc = await request(app.getHttpServer())
        .get(`/api/v1/ingresos?sedeId=${sedeId}&fecha=2026-03-15`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(diaUtc.body).toHaveLength(0);
    });

    it('la paginacion no repite filas entre paginas', async () => {
      const sedeId = await crearSede(10);
      const esperados: number[] = [];

      for (let i = 0; i < 3; i++) {
        const { socioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
        const res = await request(app.getHttpServer())
          .post('/api/v1/ingresos')
          .send({ sedeId: sedeId, socioId: socioId, codigoTotp: '123456' })
          .expect(201);
        esperados.push(res.body.id);
      }

      const token = await tokenRecepcion(sedeId);
      const vistos: number[] = [];
      for (const page of [1, 2, 3]) {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/ingresos?sedeId=${sedeId}&perPage=1&page=${page}`)
          .set('Authorization', `Bearer ${token}`)
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
      const token = await tokenRecepcion(sedesCreadas[0]);
      // perPage por encima del maximo del contrato
      await request(app.getHttpServer()).get(`${q}?perPage=500`).set('Authorization', `Bearer ${token}`).expect(422);
      // fecha como instante en vez de dia
      await request(app.getHttpServer()).get(`${q}?fecha=2026-03-15T01:30:00.000Z`).set('Authorization', `Bearer ${token}`).expect(422);
      // fecha en formato regional
      await request(app.getHttpServer()).get(`${q}?fecha=15-03-2026`).set('Authorization', `Bearer ${token}`).expect(422);
      // dentro con un valor que no es boolean: si se casteara con Boolean(),
      // "1" y "false" se volverian true y el filtro pasaria silenciosamente.
      await request(app.getHttpServer()).get(`${q}?dentro=1`).set('Authorization', `Bearer ${token}`).expect(422);
      await request(app.getHttpServer()).get(`${q}?dentro=quilmil`).set('Authorization', `Bearer ${token}`).expect(422);
      // paginacion en cero
      await request(app.getHttpServer()).get(`${q}?page=0`).set('Authorization', `Bearer ${token}`).expect(422);
    });

    it('RNF-01: el puesto offline reporta la hora real del acceso', async () => {
      const sedeId = await crearSede(10);
      const { socioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      const momentoReal = '2026-05-04T22:15:00.000Z';
      const res = await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({
          sedeId: sedeId,
          socioId: socioId,
          codigoTotp: '123456',
          fechaHoraIngreso: momentoReal,
          validadoOffline: true,
        })
        .expect(201);

      expect(res.body.validadoOffline).toBe(true);
      // El instante enviado tiene que volver tal cual: el servidor no lo pisa.
      expect(new Date(res.body.fechaHoraIngreso).toISOString()).toBe(momentoReal);

      const detalle = await request(app.getHttpServer())
        .get(`/api/v1/ingresos/${res.body.id}`)
        .expect(200);
      expect(detalle.body.validadoOffline).toBe(true);
      expect(new Date(detalle.body.fechaHoraIngreso).toISOString()).toBe(momentoReal);
    });
  });

  // Unidad III: GET /ingresos y el egreso están protegidos y el RECEPCION solo
  // ve/egresa en su sede. Estas pruebas fijan esa regla y el filtro ?nombre=.
  describe('M2 - acceso por sede y búsqueda por nombre (Unidad III)', () => {
    async function crearSede(aforo: number): Promise<number> {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sedes')
        .send({ nombre: 'Sede E2E Sede-Scope', direccion: 'Calle Falsa 555', aforoMaximo: aforo })
        .expect(201);
      sedesCreadas.push(res.body.id);
      return res.body.id as number;
    }

    async function ingresar(sedeId: number, socioId: number): Promise<number> {
      const res = await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({ sedeId: sedeId, socioId: socioId, codigoTotp: '123456' })
        .expect(201);
      return res.body.id as number;
    }

    it('RECEPCION solo ve su sede aunque pida otra en el query', async () => {
      const sedeA = await crearSede(10);
      const sedeB = await crearSede(10);
      const enA = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeA });
      const enB = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeB });
      const ingresoA = await ingresar(sedeA, enA.socioId);
      await ingresar(sedeB, enB.socioId);

      // Token de la sede A; se pide explícitamente la sede B.
      const tokenA = await tokenRecepcion(sedeA);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/ingresos?sedeId=${sedeB}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // La sede del JWT manda: solo aparece el ingreso de A.
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(ingresoA);
      expect(res.body[0].sedeId).toBe(sedeA);
    });

    it('RECEPCION no puede egresar un ingreso de otra sede (403)', async () => {
      const sedeA = await crearSede(10);
      const sedeB = await crearSede(10);
      const enB = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeB });
      const ingresoB = await ingresar(sedeB, enB.socioId);

      const tokenA = await tokenRecepcion(sedeA);
      await request(app.getHttpServer())
        .post(`/api/v1/ingresos/${ingresoB}/egreso`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);
    });

    it('el listado exige token (401 sin Authorization)', async () => {
      await request(app.getHttpServer()).get('/api/v1/ingresos').expect(401);
    });

    it('filtra por nombre parcial, sin distinguir mayúsculas', async () => {
      const sedeId = await crearSede(10);
      const objetivo = 'Wenceslao Ñandú';
      const socio = await crearSocioConMembresia({
        vigente: true,
        sedeOrigenId: sedeId,
        nombre: objetivo,
      });
      await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId, nombre: 'Otro Socio' });
      const ingresoId = await ingresar(sedeId, socio.socioId);

      const token = await tokenRecepcion(sedeId);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/ingresos?sedeId=${sedeId}&nombre=ñand`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(ingresoId);
      expect(res.body[0].nombre).toBe(objetivo);
      expect(res.body[0].dni).toBeTruthy();
    });
  });
});
