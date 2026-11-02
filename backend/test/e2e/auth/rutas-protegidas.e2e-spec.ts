import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { load } from 'js-yaml';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from 'src/app.module';
import { ProblemFilter } from 'src/commons/filters/problem.filter';
import { conParametrosDeEjemplo, etiqueta, listarRutasDeLaApp } from '@test/helpers/rutas-app';
import type { RutaDeLaApp } from '@test/helpers/rutas-app';

// Red de seguridad del guard global: todo endpoint exige sesion salvo los marcados @Public(). El conjunto de rutas publicas esta
// fijado a proposito: si alguien agrega otro @Public(), el test falla y obliga a actualizar esta lista con conciencia.
const RUTAS_PUBLICAS = ['POST /api/v1/auth/login', 'POST /api/v1/auth/logout', 'POST /api/v1/auth/refresh'];

// Mensaje con el que JwtAuthGuard rechaza un pedido sin token (distinto de los 401 propios de login/refresh).
const DETALLE_SIN_TOKEN = 'El token es inválido, expiró o no fue provisto.';

// Dentro de un path, `parameters` (los comunes a todas sus operaciones) no es una operacion.
const VERBOS_HTTP = new Set(['get', 'post', 'put', 'patch', 'delete']);

interface ContratoOpenApi {
  paths: Record<string, Record<string, { security?: unknown[] }>>;
  security?: unknown[];
}

// "POST /api/v1/ingresos/{ingresoId}" -> "POST /api/v1/ingresos/:ingresoId" para compararlo con las rutas de Nest.
function operacionesDelContrato(): Map<string, boolean> {
  const contrato = load(readFileSync(resolve(import.meta.dirname,'../../../../docs/openapi.yaml'), 'utf8')) as ContratoOpenApi;
  const operaciones = new Map<string, boolean>();
  for (const [ruta, verbos] of Object.entries(contrato.paths)) {
    for (const [verbo, operacion] of Object.entries(verbos)) {
      if (!VERBOS_HTTP.has(verbo)) continue;
      const seguridad = operacion.security ?? contrato.security ?? [];
      operaciones.set(`${verbo.toUpperCase()} /api/v1${ruta.replace(/\{(\w+)\}/g, ':$1')}`, seguridad.length === 0);
    }
  }
  return operaciones;
}

describe('Guard global - rutas protegidas por defecto y rutas publicas (e2e)', () => {
  let app: INestApplication;
  let rutas: RutaDeLaApp[];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new ProblemFilter());
    await app.init();
    rutas = listarRutasDeLaApp(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('el conjunto de rutas publicas es exactamente login, refresh y logout', () => {
    const publicas = rutas.filter((r) => r.publica).map(etiqueta).sort();

    expect(publicas).toEqual(RUTAS_PUBLICAS);
  });

  it('las rutas de la app son las del contrato, y publicas son las mismas que declara el contrato (security: [])', () => {
    const delContrato = operacionesDelContrato();
    const delCodigo = new Map(rutas.map((r) => [etiqueta(r), r.publica]));

    expect([...delCodigo.keys()].sort()).toEqual([...delContrato.keys()].sort());
    expect(delCodigo).toEqual(delContrato);
  });

  it('recorre las 54 operaciones del contrato (51 protegidas y 3 publicas)', () => {
    expect(rutas).toHaveLength(54);
    expect(rutas.filter((r) => !r.publica)).toHaveLength(51);
  });

  it('SIN token, toda ruta que no es publica responde 401 del guard', async () => {
    const fallas: string[] = [];

    for (const r of rutas.filter((x) => !x.publica)) {
      const res = await request(app.getHttpServer())[r.metodo](conParametrosDeEjemplo(r.ruta));
      if (res.status !== 401 || res.body.detail !== DETALLE_SIN_TOKEN) {
        fallas.push(`${etiqueta(r)} -> ${res.status} ${res.body?.detail ?? ''}`);
      }
    }

    expect(fallas).toEqual([]);
  });

  it('CON un token invalido, toda ruta que no es publica tambien responde 401', async () => {
    const fallas: string[] = [];

    for (const r of rutas.filter((x) => !x.publica)) {
      const res = await request(app.getHttpServer())
        [r.metodo](conParametrosDeEjemplo(r.ruta))
        .set('Authorization', 'Bearer no-es-un-jwt');
      if (res.status !== 401) fallas.push(`${etiqueta(r)} -> ${res.status}`);
    }

    expect(fallas).toEqual([]);
  });

  it('SIN token, las rutas publicas no las rechaza el guard (responden por su propia logica)', async () => {
    const respuestas: Record<string, { status: number; detail?: string }> = {};

    for (const r of rutas.filter((x) => x.publica)) {
      const res = await request(app.getHttpServer())[r.metodo](conParametrosDeEjemplo(r.ruta));
      respuestas[etiqueta(r)] = { status: res.status, detail: res.body?.detail };
    }

    for (const [ruta, { detail }] of Object.entries(respuestas)) {
      expect(detail, ruta).not.toBe(DETALLE_SIN_TOKEN);
    }
    // login sin cuerpo: valida y rechaza el DTO; logout sin token es idempotente; refresh sin token es su 401 propio.
    expect(respuestas['POST /api/v1/auth/login'].status).toBe(422);
    expect(respuestas['POST /api/v1/auth/logout'].status).toBe(204);
    expect(respuestas['POST /api/v1/auth/refresh'].status).toBe(401);
  });
});
