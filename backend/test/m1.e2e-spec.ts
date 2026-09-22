import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProblemFilter } from '../src/commons/filters/problem.filter';
import { PrismaService } from '../src/commons/database/prisma.service';

// Flujo completo de M1: crear usuario -> hacerse socio con plan -> consultar
// membresia -> dejar de ser socio (vuelve a EXTERNO). Corre contra la base
// de test levantada con docker-compose.test.yml (ver docs/TESTING.md).
//
// Nota: M1 no tiene endpoint propio para crear Sede (eso vive en M2, que
// todavia no esta implementado), asi que la sede necesaria para
// CrearSocioDto.sede_origen_id se inserta directo con Prisma en
// beforeAll, no via HTTP.

describe('M1 - Usuarios / Socios / Membresias (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sedeId: number;

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
        nombre: 'Sede Test E2E',
        direccion: 'Calle Falsa 123',
        aforo_maximo: 50,
      },
    });
    sedeId = sede.id;
  });

  afterAll(async () => {
    // Limpieza en orden inverso a las FKs (membresia -> socio -> usuario -> sede).
    await prisma.membresia.deleteMany({});
    await prisma.socio.deleteMany({});
    await prisma.usuario.deleteMany({ where: { email: { contains: '@e2e.fitzone.test' } } });
    await prisma.sede.delete({ where: { id: sedeId } });
    await app.close();
  });

  const emailUnico = () => `socio.${Date.now()}.${Math.floor(Math.random() * 1000)}@e2e.fitzone.test`;
  const dniUnico = () => String(10000000 + Math.floor(Math.random() * 89999999));

  it('flujo completo: usuario -> socio -> membresia -> baja', async () => {
    // 1) POST /usuarios
    const crearUsuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Socio E2E',
        email: emailUnico(),
        contrasenia: 'clave12345',
      })
      .expect(201);

    expect(crearUsuarioRes.body.contrasenia).toBeUndefined();
    const usuarioId: number = crearUsuarioRes.body.id;
    expect(typeof usuarioId).toBe('number');

    // 2) POST /socios con plan -> crea socio + membresia en la misma transaccion
    const crearSocioRes = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({
        usuario_id: usuarioId,
        sede_origen_id: sedeId,
        plan: 'MENSUAL',
      })
      .expect(201);

    const socioId: number = crearSocioRes.body.id;
    expect(crearSocioRes.body.usuario_id).toBe(usuarioId);

    // El usuario ahora es SOCIO
    const usuarioComoSocio = await request(app.getHttpServer())
      .get(`/api/v1/usuarios/${usuarioId}`)
      .expect(200);
    expect(usuarioComoSocio.body.rol).toBe('SOCIO');

    // 3) GET /socios/{socioId}/membresias -> fecha_fin = fecha_inicio + 1 mes
    const membresiaRes = await request(app.getHttpServer())
      .get(`/api/v1/socios/${socioId}/membresias`)
      .expect(200);

    expect(membresiaRes.body.plan).toBe('MENSUAL');
    const inicio = new Date(membresiaRes.body.fecha_inicio);
    const fin = new Date(membresiaRes.body.fecha_fin);
    const esperado = new Date(inicio);
    esperado.setMonth(esperado.getMonth() + 1);
    expect(fin.toISOString().slice(0, 10)).toBe(esperado.toISOString().slice(0, 10));

    // 4) DELETE /socios/{socioId} -> 204, usuario vuelve a EXTERNO
    await request(app.getHttpServer())
      .delete(`/api/v1/socios/${socioId}`)
      .expect(204);

    const usuarioFinal = await request(app.getHttpServer())
      .get(`/api/v1/usuarios/${usuarioId}`)
      .expect(200);
    expect(usuarioFinal.body.rol).toBe('EXTERNO');

    await request(app.getHttpServer())
      .get(`/api/v1/socios/${socioId}/membresias`)
      .expect(404);
  });

  it('POST /socios responde 404 si usuario_id no existe', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: 999999, sede_origen_id: sedeId })
      .expect(404);
  });

  it('POST /socios responde 409 si el usuario ya es socio', async () => {
    const usuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Ya Socio E2E',
        email: emailUnico(),
        contrasenia: 'clave12345',
      })
      .expect(201);
    const usuarioId = usuarioRes.body.id;

    await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioId, sede_origen_id: sedeId })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioId, sede_origen_id: sedeId })
      .expect(409);
  });

  it('POST /socios/{id}/membresias responde 409 si el socio ya tiene membresia', async () => {
    const usuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Doble Membresia E2E',
        email: emailUnico(),
        contrasenia: 'clave12345',
      })
      .expect(201);

    const socioRes = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({
        usuario_id: usuarioRes.body.id,
        sede_origen_id: sedeId,
        plan: 'MENSUAL',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/socios/${socioRes.body.id}/membresias`)
      .send({ plan: 'ANUAL' })
      .expect(409);
  });
});
