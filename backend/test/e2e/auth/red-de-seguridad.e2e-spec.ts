import { Controller, Get, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/commons/database/prisma.service';
import { ProblemFilter } from 'src/commons/filters/problem.filter';
import { Public } from 'src/commons/guards/public.decorator';
import { Roles } from 'src/commons/guards/roles.decorator';
import { conToken, crearUsuarioConSesion } from '@test/helpers/sesion';

// Controllers descartables, solo de este test: ninguno declara guards. Demuestran que un endpoint nuevo nace protegido por
// el guard global (APP_GUARD de AppModule), sin que su autor tenga que acordarse de nada.
@Controller('descartable')
class ControllerDescartable {
  @Get('sin-marcas')
  sinMarcas() {
    return { ok: true };
  }

  @Get('solo-gerente')
  @Roles('GERENTE')
  soloGerente() {
    return { ok: true };
  }

  @Public()
  @Get('abierta')
  abierta() {
    return { ok: true };
  }
}

describe('Guard global - un controller nuevo nace protegido (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const usuarios: number[] = [];
  let tokenGerente: string;
  let tokenExterno: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ControllerDescartable],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new ProblemFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const gerente = await crearUsuarioConSesion(app, prisma, 'GERENTE', 'e2e.red.seguridad');
    const externo = await crearUsuarioConSesion(app, prisma, 'EXTERNO', 'e2e.red.seguridad');
    usuarios.push(gerente.usuarioId, externo.usuarioId);
    tokenGerente = gerente.token;
    tokenExterno = externo.token;
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
    await app.close();
  });

  it('un endpoint sin guards ni @Public() responde 401 sin token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/descartable/sin-marcas').expect(401);

    expect(res.body).toMatchObject({ status: 401, detail: 'El token es inválido, expiró o no fue provisto.' });
  });

  it('el mismo endpoint responde 200 con una sesion valida (cualquier rol: sin @Roles alcanza la sesion)', async () => {
    await request(app.getHttpServer()).get('/api/v1/descartable/sin-marcas').set(conToken(tokenExterno)).expect(200);
  });

  it('el guard global de roles tambien aplica sin UseGuards: 403 para el rol equivocado, 200 para el correcto', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/descartable/solo-gerente')
      .set(conToken(tokenExterno))
      .expect(403);
    expect(res.body.detail).toBe('No tiene permisos para acceder a este recurso.');

    await request(app.getHttpServer()).get('/api/v1/descartable/solo-gerente').set(conToken(tokenGerente)).expect(200);
  });

  it('sin token el 401 le gana al 403 (la sesion se valida antes que el rol)', async () => {
    await request(app.getHttpServer()).get('/api/v1/descartable/solo-gerente').expect(401);
  });

  it('un endpoint @Public() responde 200 sin token', async () => {
    await request(app.getHttpServer()).get('/api/v1/descartable/abierta').expect(200);
  });

  it('una ruta inexistente sigue dando 404 y no 401 (el guard solo corre con ruta resuelta)', async () => {
    await request(app.getHttpServer()).get('/api/v1/no-existe').expect(404);
  });
});
