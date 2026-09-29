import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProblemFilter } from '../src/commons/filters/problem.filter';

// Contrato de los 4xx que produce el framework. El path param no numerico
// responde 422 y no 400: el contrato declara 422 como codigo de validacion en
// 36 de sus 47 operaciones y solo 11 declaran 400, ninguna por path param. El
// unico 400 legitimo es el JSON invalido del body, que muere en el body-parser.
// Este spec fija que los dos casos salen como application/problem+json y con
// `detail` en español.
//
// Se prueba contra M1 y M3 a proposito, para dejar fijo que el comportamiento es
// del filtro global y no de un modulo en particular.
//
// Ninguno de estos casos toca la base: el body roto muere en el body-parser y el
// id no numerico en el ParseIntPipe, los dos antes de que corra el controller.
// Por eso no hay fixtures ni cleanup, solo app.close().
//
// OJO: el JSON roto se manda como STRING crudo a proposito. Si se mandara un
// objeto, supertest lo serializaria, el body seria valido, y el test pasaria por
// 422 en vez de 400 -- o sea, fallaria por el motivo equivocado.

const DETALLE_400 =
  'La solicitud está mal formada: el cuerpo no es JSON válido o algún parámetro tiene un formato inválido.';
const DETALLE_422 = 'Uno o más campos no cumplen las reglas de validación.';
const DETALLE_404 = 'La ruta solicitada no existe o el recurso no fue encontrado.';

// Mensajes que produce Nest/body-parser en ingles. El filtro los reemplaza por
// texto fijo en español (resolveDetail en problem.filter.ts) y deja el original
// solo en el log del servidor, asi que ninguno debe aparecer en la respuesta.
const FRAGMENTOS_ENGLANDES = [
  /Cannot (GET|POST|PUT|PATCH|DELETE)/,
  /Expected .* in JSON/,
  /numeric string/,
  /Validation failed/,
];

function sinIngles(res: request.Response): void {
  for (const frag of FRAGMENTOS_ENGLANDES) {
    expect(String(res.body.detail)).not.toMatch(frag);
  }
}

describe('Errores 4xx de framework - parseo, path params y ruta inexistente (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('JSON invalido en el body', () => {
    it('POST /socios con body roto responde 400 problem+json en español', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/socios')
        .set('Content-Type', 'application/json')
        .send('{"dni": 123,}');

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body.status).toBe(400);
      expect(res.body.title).toBe('Solicitud incorrecta');
      expect(res.body.detail).toBe(DETALLE_400);
      sinIngles(res);
    });

    it('POST /clases con body roto responde 400 problem+json en español', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .set('Content-Type', 'application/json')
        .send('{"nombre": "Funcional",}');

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body.status).toBe(400);
      expect(res.body.detail).toBe(DETALLE_400);
      sinIngles(res);
    });
  });

  describe('Path param no numerico', () => {
    it('GET /socios/{socio_id} no numerico responde 422 problem+json en español', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/socios/abc')
        .expect(422);

      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body.status).toBe(422);
      expect(res.body.title).toBe('Error de validación');
      expect(res.body.detail).toBe(DETALLE_422);
      sinIngles(res);
    });

    it('GET /clases/{clase_id} no numerico responde 422 problem+json en español', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/clases/abc')
        .expect(422);

      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body.status).toBe(422);
      expect(res.body.detail).toBe(DETALLE_422);
      sinIngles(res);
    });
  });

  describe('Ruta inexistente', () => {
    it('responde 404 problem+json en español, sin repetir el path en el detail', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/no-existe').expect(404);

      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body.status).toBe(404);
      expect(res.body.title).toBe('Recurso no encontrado');
      expect(res.body.detail).toBe(DETALLE_404);
      // El path viaja en `instance`, no duplicado dentro de `detail`.
      expect(res.body.instance).toBe('/api/v1/no-existe');
      expect(res.body.detail).not.toContain('/api/v1/no-existe');
      sinIngles(res);
    });

    it('metodo no soportado tambien responde 404 en español', async () => {
      const res = await request(app.getHttpServer()).delete('/api/v1/usuarios').expect(404);

      expect(res.body.detail).toBe(DETALLE_404);
      sinIngles(res);
    });
  });

  describe('El 422 de ValidationPipe no se toca', () => {
    it('sigue devolviendo 422 en español con el detalle de los campos', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/socios')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ dni: 1 }))
        .expect(422);

      expect(res.body.title).toBe('Error de validación');
      expect(res.body.detail).toBe(
        'Uno o más campos no cumplen las reglas de validación.',
      );
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });
  });
});
