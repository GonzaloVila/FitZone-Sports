import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { authenticator } from 'otplib';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/commons/database/prisma.service';
import { ProblemFilter } from '../src/commons/filters/problem.filter';
import { PRECIOS_PLAN } from '../src/modules/m1-usuarios/entities/membresia.entity';

// Unidad III por e2e (antes solo en smoke-auth-qr.cjs): login JWT (200/401),
// registro de QR dinámico (TOTP), ingreso con TOTP válido/inválido, GET
// /bloqueados y POST /sincronizacion/ingresos (RNF-01). El QR/TOTP solo se puede
// probar de verdad por HTTP: el secreto sale cifrado en la BD y otplib valida contra
// el qr_uri que devolvió el endpoint.

describe('Auth / TOTP / Bloqueados / Sincronización (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sedeId: number;
  let socioAutenticadoId: number;
  let tokenRecepcion: string;

  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];
  const sedesCreadas: number[] = [];

  const emailUnico = (tag: string) =>
    `auth.${tag}.${Date.now()}.${Math.floor(Math.random() * 100000)}@e2e.fitzone.test`;
  const dniUnico = () => String(20000000 + Math.floor(Math.random() * 89999999));

  async function crearUsuario(rol: string, tag: string): Promise<number> {
    const usuario = await prisma.usuario.create({
      data: {
        rol: rol as never,
        dni: dniUnico(),
        nombre: `Auth E2E ${tag}`,
        email: emailUnico(tag),
        contrasenia: await bcrypt.hash('clave12345', 10),
      },
    });
    usuariosCreados.push(usuario.id);
    return usuario.id;
  }

  async function crearSocio(usuarioId: number, opciones: { clavesEnMora?: boolean } = {}) {
    const socio = await prisma.socio.create({
      data: { usuario_id: usuarioId, sede_origen_id: sedeId, fecha_alta: new Date() },
    });
    sociosCreados.push(socio.id);

    const ahora = new Date();
    const fechaFin = new Date(ahora);
    fechaFin.setDate(fechaFin.getDate() + (opciones.clavesEnMora ? -5 : 30));

    await prisma.membresia.create({
      data: {
        socio_id: socio.id,
        plan: 'MENSUAL',
        estado: opciones.clavesEnMora ? 'VENCIDA' : 'ACTIVA',
        fecha_inicio: ahora,
        fecha_fin: fechaFin,
        precio: PRECIOS_PLAN.MENSUAL,
        renueva_automatica: false,
      },
    });

    return socio.id;
  }

  function loginReq(email: string, contrasenia: string) {
    return request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, contrasenia });
  }

  async function tokenDe(email: string): Promise<string> {
    const res = await loginReq(email, 'clave12345').expect(200);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new ProblemFilter());
    await app.init();

    prisma = app.get(PrismaService);

    const sede = await prisma.sede.create({
      data: { nombre: 'Sede E2E Auth', direccion: 'Calle Auth 123', aforo_maximo: 50 },
    });
    sedeId = sede.id;
    sedesCreadas.push(sede.id);

    // Una sola RECEPCION para toda la suite: EmpleadoSede es 1:1 con la Sede
    // (el @unique de sede_id lo impide duplicar), así que se crea una vez.
    const recepcionId = await crearUsuario('RECEPCION', 'recepUnica');
    await prisma.empleadoSede.create({ data: { usuario_id: recepcionId, sede_id: sedeId } });
    tokenRecepcion = await tokenDe(
      (await prisma.usuario.findUniqueOrThrow({ where: { id: recepcionId } })).email,
    );
  });

  afterAll(async () => {
    await prisma.ingreso.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.empleadoSede.deleteMany({ where: { usuario_id: { in: usuariosCreados } } });
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.deleteMany({ where: { id: { in: sedesCreadas } } });
    await app.close();
  });

  it('login de un SOCIO devuelve accessToken, rol y socioId', async () => {
    const usuarioId = await crearUsuario('SOCIO', 'socioL');
    socioAutenticadoId = await crearSocio(usuarioId);

    const email = (await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } })).email;
    const res = await loginReq(email, 'clave12345').expect(200);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.rol).toBe('SOCIO');
    expect(res.body.socioId).toBe(socioAutenticadoId);
  });

  it('login de un RECEPCION incluye sedeId en el payload', async () => {
    const email = (await prisma.usuario.findFirstOrThrow({ where: { nombre: 'Auth E2E recepUnica' } })).email;
    const res = await loginReq(email, 'clave12345').expect(200);

    expect(res.body.rol).toBe('RECEPCION');
    expect(res.body.sedeId).toBe(sedeId);
  });

  it('login con credenciales inválidas responde 401 en los dos casos (mail inexistente / pass mala)', async () => {
    const usuarioId = await crearUsuario('EXTERNO', 'malPass');
    const email = (await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } })).email;

    await loginReq(email, 'otra-password').expect(401);
    await loginReq(emailUnico('fantasma'), 'clave12345').expect(401);
  });

  it('POST /auth/registro-qr genera un otpauth URI para el SOCIO autenticado', async () => {
    const email = (await prisma.usuario.findFirstOrThrow({
      where: { id: (await prisma.socio.findUniqueOrThrow({ where: { id: socioAutenticadoId } })).usuario_id },
    })).email;
    const token = await tokenDe(email);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/registro-qr')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(res.body.qrUri).toMatch(/^otpauth:\/\//);
    expect(res.body.qrUri).toMatch(/secret=/);
  });

  it('registro-qr sin token responde 401 y con un RECEPCION responde 403', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/registro-qr').expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/registro-qr')
      .set('Authorization', `Bearer ${tokenRecepcion}`)
      .expect(403);
  });

  it('POST /ingresos valida el TOTP del QR (válido 201, inválido 403)', async () => {
    const email = (await prisma.usuario.findFirstOrThrow({
      where: { id: (await prisma.socio.findUniqueOrThrow({ where: { id: socioAutenticadoId } })).usuario_id },
    })).email;
    const token = await tokenDe(email);

    // Registra el QR y usa el SECRETO REAL de esta corrida (cada registro genera
    // uno nuevo que sobrescribe el anterior).
    const qr = await request(app.getHttpServer())
      .post('/api/v1/auth/registro-qr')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const secreto = qr.body.qrUri.match(/secret=([^&]+)/)![1];

    const codigo = authenticator.generate(secreto);
    const ingreso = await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sedeId, socioId: socioAutenticadoId, codigoTotp: codigo })
      .expect(201);
    const ingresoId: number = ingreso.body.id;

    const codigoMalo = codigo === '000000' ? '111111' : '000000';
    await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sedeId, socioId: socioAutenticadoId, codigoTotp: codigoMalo })
      .expect(403);

    // Cierra el ingreso válido para no dejar el socio "dentro" (RN-01).
    await request(app.getHttpServer())
      .post(`/api/v1/ingresos/${ingresoId}/egreso`)
      .set('Authorization', `Bearer ${tokenRecepcion}`)
      .expect(204);
  });

  it('GET /bloqueados: RECEPCION 200 con los no vigentes; SOCIO 403; sin token 401', async () => {
    const bloqueadoId = await crearUsuario('EXTERNO', 'bloqueado');
    const socioBloqueado = await crearSocio(bloqueadoId, { clavesEnMora: true });

    const res = await request(app.getHttpServer())
      .get('/api/v1/bloqueados')
      .set('Authorization', `Bearer ${tokenRecepcion}`)
      .expect(200);
    expect(Array.isArray(res.body.bloqueados)).toBe(true);
    expect(res.body.bloqueados.map((b: { socioId: number }) => b.socioId)).toContain(socioBloqueado);

    await request(app.getHttpServer()).get('/api/v1/bloqueados').expect(401);

    const emailSocio = (await prisma.usuario.findFirstOrThrow({
      where: { id: (await prisma.socio.findUniqueOrThrow({ where: { id: socioAutenticadoId } })).usuario_id },
    })).email;
    const tokenSocio = await tokenDe(emailSocio);
    await request(app.getHttpServer())
      .get('/api/v1/bloqueados')
      .set('Authorization', `Bearer ${tokenSocio}`)
      .expect(403);
  });

  it('POST /sincronizacion/ingresos: RECEPCION sincroniza su sede; sin token 401', async () => {
    const sanoId = await crearUsuario('EXTERNO', 'syncOk');
    const socioSano = await crearSocio(sanoId);

    const res = await request(app.getHttpServer())
      .post('/api/v1/sincronizacion/ingresos')
      .set('Authorization', `Bearer ${tokenRecepcion}`)
      .send({
        ingresos: [{ localId: 1, socioId: socioSano, fechaHoraIngreso: new Date().toISOString() }],
        egresos: [],
      })
      .expect(201);

    expect(res.body.resultados[0]).toMatchObject({ localId: 1, ok: true });
    expect(res.body.resultados[0].serverId).toBeTypeOf('number');

    await request(app.getHttpServer())
      .post('/api/v1/sincronizacion/ingresos')
      .send({ ingresos: [], egresos: [] })
      .expect(401);
  });

  it('la sincronización reporta ítems bloqueados y duplicados sin romper el lote', async () => {
    const enMoraId = await crearUsuario('EXTERNO', 'syncMora');
    const socioEnMora = await crearSocio(enMoraId, { clavesEnMora: true });

    const dentroId = await crearUsuario('EXTERNO', 'syncDentro');
    const socioDentro = await crearSocio(dentroId);
    await request(app.getHttpServer())
      .post('/api/v1/ingresos')
      .send({ sedeId, socioId: socioDentro, codigoTotp: '123456' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/v1/sincronizacion/ingresos')
      .set('Authorization', `Bearer ${tokenRecepcion}`)
      .send({
        ingresos: [
          { localId: 10, socioId: socioEnMora, fechaHoraIngreso: new Date().toISOString() },
          { localId: 11, socioId: socioDentro, fechaHoraIngreso: new Date().toISOString() },
        ],
        egresos: [],
      })
      .expect(201);

    const porLocal = new Map(res.body.resultados.map((r: { localId: number; error?: string }) => [r.localId, r]));
    expect(porLocal.get(10)).toMatchObject({ ok: false, error: 'USUARIO_BLOQUEADO' });
    expect(porLocal.get(11)).toMatchObject({ ok: false, error: 'YA_DENTRO' });
  });

  it('RNF-01: sincroniza egresos del mismo lote y reporta el egreso de un ingreso ausente', async () => {
    const sanoId = await crearUsuario('EXTERNO', 'syncEgreso');
    const socio = await crearSocio(sanoId);

    const primera = await request(app.getHttpServer())
      .post('/api/v1/sincronizacion/ingresos')
      .set('Authorization', `Bearer ${tokenRecepcion}`)
      .send({
        ingresos: [{ localId: 5, socioId: socio, fechaHoraIngreso: new Date().toISOString() }],
        // El egreso referencia un ingreso DEL MISMO lote vía ingresoLocalId.
        egresos: [
          {
            localId: 6,
            ingresoLocalId: 5,
            fechaHoraEgreso: new Date(Date.now() + 3600_000).toISOString(),
          },
        ],
      })
      .expect(201);

    expect(primera.body.resultados[0]).toMatchObject({ localId: 5, ok: true });
    expect(primera.body.egresosProcesados[0]).toMatchObject({ localId: 6, ok: true });

    // Un egreso que apunta a un ingreso que NO está en el lote no rompe el lote.
    const segunda = await request(app.getHttpServer())
      .post('/api/v1/sincronizacion/ingresos')
      .set('Authorization', `Bearer ${tokenRecepcion}`)
      .send({
        ingresos: [],
        egresos: [{ localId: 7, ingresoLocalId: 5, fechaHoraEgreso: new Date().toISOString() }],
      })
      .expect(201);

    expect(segunda.body.egresosProcesados[0]).toMatchObject({
      localId: 7,
      ok: false,
      error: 'INGRESO_NO_ENCONTRADO',
    });
  });

  it('GET /bloqueados respeta ?actualizadoDesde= (sincronización incremental)', async () => {
    const usuarioId = await crearUsuario('EXTERNO', 'bloqDelta');
    const socio = await crearSocio(usuarioId, { clavesEnMora: true });

    const desdeAntes = await request(app.getHttpServer())
      .get('/api/v1/bloqueados?actualizadoDesde=1970-01-01T00:00:00.000Z')
      .set('Authorization', `Bearer ${tokenRecepcion}`)
      .expect(200);
    expect(desdeAntes.body.bloqueados.map((b: { socioId: number }) => b.socioId)).toContain(socio);

    const futuro = encodeURIComponent(new Date(Date.now() + 60_000).toISOString());
    const desdeFuturo = await request(app.getHttpServer())
      .get(`/api/v1/bloqueados?actualizadoDesde=${futuro}`)
      .set('Authorization', `Bearer ${tokenRecepcion}`)
      .expect(200);
    expect(desdeFuturo.body.bloqueados.map((b: { socioId: number }) => b.socioId)).not.toContain(socio);
  });

  it('GET /bloqueados con rol GERENTE responde 200', async () => {
    const gerenteId = await crearUsuario('GERENTE', 'gerente');
    const email = (await prisma.usuario.findUniqueOrThrow({ where: { id: gerenteId } })).email;
    const token = await tokenDe(email);

    const res = await request(app.getHttpServer())
      .get('/api/v1/bloqueados')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body.bloqueados)).toBe(true);
  });
});