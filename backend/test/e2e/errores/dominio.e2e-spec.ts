import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from 'src/app.module';
import { ProblemFilter } from 'src/commons/filters/problem.filter';
import { PrismaService } from 'src/commons/database/prisma.service';

// Errores de DOMINIO: los 404 y 409 que lanzan los services, con su detail y title
// propios (el filtro NO los colapsa a un texto genérico). Hasta cf97644 el filtro
// reemplazaba el detail de todo 4xx y ningún spec miraba el body → el bug pasó con
// 38/38 en verde. Estos tests tienen que fallar si un error de dominio pierde su mensaje.
describe('Errores de dominio - 404 y 409 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sedeId: number;

  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];

  const emailUnico = () => `errores.${Date.now()}.${Math.floor(Math.random() * 1000)}@e2e.fitzone.test`;
  const dniUnico = () => String(10000000 + Math.floor(Math.random() * 89999999));

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new ProblemFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const sede = await prisma.sede.create({
      data: { nombre: 'Sede Errores E2E', direccion: 'Calle Falsa 456', aforo_maximo: 50 },
    });
    sedeId = sede.id;
  });

  afterAll(async () => {
    // El alta cobra la membresía (RF-02): se borran los pagos por usuario antes del Usuario.
    const pagos = await prisma.pago.findMany({ where: { usuario_id: { in: usuariosCreados } }, select: { id: true } });
    const idsPagos = pagos.map((p) => p.id);
    if (idsPagos.length > 0) {
      await prisma.pagoMembresia.deleteMany({ where: { id_pago: { in: idsPagos } } });
      await prisma.pago.deleteMany({ where: { id: { in: idsPagos } } });
    }
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.delete({ where: { id: sedeId } });
    await app.close();
  });

  async function crearUsuario(overrides: Record<string, unknown> = {}): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({ rol: 'EXTERNO', dni: dniUnico(), nombre: 'Errores E2E', email: emailUnico(), contrasenia: 'clave12345', ...overrides })
      .expect(201);
    usuariosCreados.push(res.body.id);
    return res.body.id;
  }

  function esProblemDeDominio(res: request.Response, status: number): void {
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body.status).toBe(status);
    expect(res.body.type).toBe('about:blank');
    expect(typeof res.body.detail).toBe('string');
    expect(res.body.detail.length).toBeGreaterThan(0);
  }

  describe('404 de dominio', () => {
    it('GET /usuarios/{id} inexistente conserva su detail y su instance', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/usuarios/999999').expect(404);

      esProblemDeDominio(res, 404);
      expect(res.body.title).toBe('Recurso no encontrado');
      expect(res.body.detail).toBe('No existe el recurso solicitado para el id indicado.');
      expect(res.body.instance).toBe('/api/v1/usuarios/999999');
    });

    it('GET /socios/{socio_id} inexistente conserva su detail', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/socios/999999').expect(404);

      esProblemDeDominio(res, 404);
      expect(res.body.detail).toBe('No existe el recurso solicitado para el id indicado.');
    });

    it('POST /socios con usuario_id inexistente conserva su detail', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/socios')
        .send({ usuarioId: 999999, sedeOrigenId: sedeId, plan: 'MENSUAL' })
        .expect(404);

      esProblemDeDominio(res, 404);
      expect(res.body.detail).toBe('No existe el usuario indicado.');
    });
  });

  describe('409 de dominio: el title sale del contrato, no de un único "Conflicto"', () => {
    it('POST /usuarios con dni duplicado', async () => {
      const dni = dniUnico();
      await crearUsuario({ dni });

      const res = await request(app.getHttpServer())
        .post('/api/v1/usuarios')
        .send({ rol: 'EXTERNO', dni, nombre: 'Dni Duplicado', email: emailUnico(), contrasenia: 'clave12345' })
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
        .send({ rol: 'EXTERNO', dni: dniUnico(), nombre: 'Email Duplicado', email, contrasenia: 'clave12345' })
        .expect(409);

      esProblemDeDominio(res, 409);
      expect(res.body.title).toBe('Conflicto de unicidad');
      expect(res.body.detail).toBe(`El email ${email} ya está registrado.`);
    });

    it('POST /socios con usuario que ya es socio', async () => {
      const usuarioId = await crearUsuario();
      const primerSocio = await request(app.getHttpServer())
        .post('/api/v1/socios')
        .send({ usuarioId, sedeOrigenId: sedeId, plan: 'MENSUAL' })
        .expect(201);
      sociosCreados.push(primerSocio.body.id);

      const res = await request(app.getHttpServer())
        .post('/api/v1/socios')
        .send({ usuarioId, sedeOrigenId: sedeId, plan: 'MENSUAL' })
        .expect(409);

      esProblemDeDominio(res, 409);
      expect(res.body.title).toBe('El usuario ya es socio');
      expect(res.body.detail).toBe(`El usuario ${usuarioId} ya tiene un registro de socio.`);
    });
  });
});
