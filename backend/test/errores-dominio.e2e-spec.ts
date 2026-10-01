import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProblemFilter } from '../src/commons/filters/problem.filter';
import { PrismaService } from '../src/commons/database/prisma.service';

// Hermano de errores-4xx.e2e-spec.ts, que fija los errores del FRAMEWORK
// (JSON invalido, path param no numerico, ruta inexistente). Este fija los de
// DOMINIO: los 404 y 409 que lanzan los services.
//
// El motivo de existir: hasta cf97644 el filtro reemplaza el `detail` de todo 4xx
// por un texto generico, y ningun spec assertaba el body de un 404/409 de
// dominio -- solo el status. Por eso el bug paso con 38/38 en verde. Estos tests
// tienen que fallar si un error de dominio vuelve a perder su mensaje.
//
// Ademas fija los `title` que declara el contrato y que el filtro colapsaba a
// "Conflicto" para los tres 409 de M1 (components.responses Conflict,
// SocioExistente y MembresiaExistente).
//
// La limpieza es por arrays de ids, como en m2 y m3, no por prefijo de email:
// asi este spec no puede tocar los fixtures de los otros aunque corran en otro
// orden.

describe('Errores de dominio - 404 y 409 de M1, M2 y M3 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sedeId: number;

  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];

  const emailUnico = () =>
    `errores.${Date.now()}.${Math.floor(Math.random() * 1000)}@e2e.fitzone.test`;
  const dniUnico = () => String(10000000 + Math.floor(Math.random() * 89999999));

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

    const sede = await prisma.sede.create({
      data: {
        nombre: 'Sede Errores E2E',
        direccion: 'Calle Falsa 456',
        aforo_maximo: 50,
      },
    });
    sedeId = sede.id;
  });

  afterAll(async () => {
    await prisma.ingreso.deleteMany({ where: { usuario_id: { in: usuariosCreados } } });
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.delete({ where: { id: sedeId } });
    await app.close();
  });

  async function crearUsuario(overrides: Record<string, unknown> = {}): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Errores E2E',
        email: emailUnico(),
        contrasenia: 'clave12345',
        ...overrides,
      })
      .expect(201);

    usuariosCreados.push(res.body.id);
    return res.body.id;
  }

  // Todo error de dominio sale como problem+json con type about:blank, salvo los
  // que usan una URI propia (los ProblemException de M2/M3, que ya estan bien).
  function esProblemDeDominio(res: request.Response, status: number): void {
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body.status).toBe(status);
    expect(res.body.type).toBe('about:blank');
    expect(typeof res.body.detail).toBe('string');
    expect(res.body.detail.length).toBeGreaterThan(0);
  }

  describe('404 de dominio', () => {
    it('GET /usuarios/{id} inexistente conserva su detail', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/usuarios/999999').expect(404);

      esProblemDeDominio(res, 404);
      expect(res.body.title).toBe('Recurso no encontrado');
      expect(res.body.detail).toBe(
        'No existe el recurso solicitado para el id indicado.',
      );
      expect(res.body.instance).toBe('/api/v1/usuarios/999999');
    });

    it('GET /socios/{socio_id} inexistente conserva su detail', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/socios/999999').expect(404);

      esProblemDeDominio(res, 404);
      expect(res.body.title).toBe('Recurso no encontrado');
      expect(res.body.detail).toBe(
        'No existe el recurso solicitado para el id indicado.',
      );
    });

    it('POST /socios con usuario_id inexistente conserva su detail', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/socios')
        .send({ usuario_id: 999999, sede_origen_id: sedeId })
        .expect(404);

      esProblemDeDominio(res, 404);
      expect(res.body.detail).toBe('No existe el usuario indicado.');
    });

    it('GET /socios/{id}/membresias sin membresia conserva su detail', async () => {
      const usuarioId = await crearUsuario();
      const socioRes = await request(app.getHttpServer())
        .post('/api/v1/socios')
        .send({ usuario_id: usuarioId, sede_origen_id: sedeId })
        .expect(201);
      const socioId: number = socioRes.body.id;
      sociosCreados.push(socioId);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/socios/${socioId}/membresias`)
        .expect(404);

      esProblemDeDominio(res, 404);
      expect(res.body.detail).toBe('El socio no posee una membresía activa.');
    });

    it('POST /ingresos con sede inexistente conserva su detail (M2)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/ingresos')
        .send({ sede_id: 999999, usuario_id: 999999, qr_token: 'qr-test' })
        .expect(404);

      esProblemDeDominio(res, 404);
      expect(res.body.detail).toBe('No existe la sede indicada.');
    });

    it('GET /clases/{id}/reservas con clase inexistente conserva su detail (M3)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/clases/999999/reservas')
        .expect(404);

      esProblemDeDominio(res, 404);
      expect(res.body.detail).toBe('No existe la clase indicada.');
    });
  });

  describe('409 de dominio: el title sale del contrato, no de un unico "Conflicto"', () => {
    it('POST /usuarios con dni duplicado', async () => {
      const dni = dniUnico();
      await crearUsuario({ dni });

      const res = await request(app.getHttpServer())
        .post('/api/v1/usuarios')
        .send({
          rol: 'EXTERNO',
          dni,
          nombre: 'Dni Duplicado',
          email: emailUnico(),
          contrasenia: 'clave12345',
        })
        .expect(409);

      esProblemDeDominio(res, 409);
      expect(res.body.title).toBe('Conflicto de unicidad');
      expect(res.body.detail).toBe(`El DNI ${dni} ya está registrado.`);
    });

    it('POST /usuarios con email duplicado', async () => {
      const email = emailUnico();
      await crearUsuario({ email });

      const res = await request(app.getHttpServer())
        .post('/api/v1/usuarios')
        .send({
          rol: 'EXTERNO',
          dni: dniUnico(),
          nombre: 'Email Duplicado',
          email,
          contrasenia: 'clave12345',
        })
        .expect(409);

      esProblemDeDominio(res, 409);
      expect(res.body.title).toBe('Conflicto de unicidad');
      expect(res.body.detail).toBe(`El email ${email} ya está registrado.`);
    });

    it('POST /socios con usuario que ya es socio', async () => {
      const usuarioId = await crearUsuario();
      const primerSocioRes = await request(app.getHttpServer())
        .post('/api/v1/socios')
        .send({ usuario_id: usuarioId, sede_origen_id: sedeId })
        .expect(201);
      sociosCreados.push(primerSocioRes.body.id);

      const res = await request(app.getHttpServer())
        .post('/api/v1/socios')
        .send({ usuario_id: usuarioId, sede_origen_id: sedeId })
        .expect(409);

      esProblemDeDominio(res, 409);
      expect(res.body.title).toBe('El usuario ya es socio');
      expect(res.body.detail).toBe(
        `El usuario ${usuarioId} ya tiene un registro de socio.`,
      );
    });

    it('POST /socios/{id}/membresias con socio que ya tiene membresia', async () => {
      const usuarioId = await crearUsuario();
      const socioRes = await request(app.getHttpServer())
        .post('/api/v1/socios')
        .send({ usuario_id: usuarioId, sede_origen_id: sedeId, plan: 'MENSUAL' })
        .expect(201);
      const socioId: number = socioRes.body.id;
      sociosCreados.push(socioId);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/socios/${socioId}/membresias`)
        .send({ plan: 'ANUAL' })
        .expect(409);

      esProblemDeDominio(res, 409);
      expect(res.body.title).toBe('Conflicto de membresía existente');
      expect(res.body.detail).toBe('El socio ya tiene una membresía activa.');
    });
  });
});
