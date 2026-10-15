import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from 'src/app.module';
import { ProblemFilter } from 'src/commons/filters/problem.filter';

// Contrato de los 4xx que produce el framework, uno por caso: JSON roto (400), path
// param no numérico (422), ruta inexistente (404) y el 422 del ValidationPipe. Es del
// filtro global, no de un módulo; ninguno toca la base.
const DETALLE_400 =
  'La solicitud está mal formada: el cuerpo no es JSON válido o algún parámetro tiene un formato inválido.';
const DETALLE_422 = 'Uno o más campos no cumplen las reglas de validación.';
const DETALLE_404 = 'La ruta solicitada no existe o el recurso no fue encontrado.';

// Mensajes que produce Nest/body-parser en inglés; el filtro los reemplaza por texto fijo.
const FRAGMENTOS_ENGLANDES = [/Cannot (GET|POST|PUT|PATCH|DELETE)/, /Expected .* in JSON/, /numeric string/, /Validation failed/];

function sinIngles(res: request.Response): void {
  for (const frag of FRAGMENTOS_ENGLANDES) {
    expect(String(res.body.detail)).not.toMatch(frag);
  }
}

describe('Errores 4xx de framework - parseo, path params y ruta inexistente (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new ProblemFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('JSON inválido en el body responde 400 problem+json en español', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .set('Content-Type', 'application/json')
      .send('{"dni": 123,}');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ status: 400, title: 'Solicitud incorrecta', detail: DETALLE_400 });
    sinIngles(res);
  });

  it('path param no numérico responde 422 problem+json en español', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/socios/abc').expect(422);

    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ status: 422, title: 'Error de validación', detail: DETALLE_422 });
    sinIngles(res);
  });

  it('ruta inexistente responde 404 problem+json sin repetir el path en el detail', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/no-existe').expect(404);

    expect(res.body).toMatchObject({ status: 404, title: 'Recurso no encontrado', detail: DETALLE_404 });
    expect(res.body.instance).toBe('/api/v1/no-existe');
    expect(res.body.detail).not.toContain('/api/v1/no-existe');
    sinIngles(res);
  });

  it('el 422 del ValidationPipe sigue devolviendo el detalle de los campos', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ dni: 1 }))
      .expect(422);

    expect(res.body.title).toBe('Error de validación');
    expect(res.body.detail).toBe(DETALLE_422);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });
});
