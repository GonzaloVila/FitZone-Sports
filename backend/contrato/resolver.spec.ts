import { describe, expect, it } from 'vitest';
import type { EsquemaCanonico } from './resolver';
import {
  canonicalizarDocumento,
  canonicalizarEsquema,
  crearContexto,
  fusionarParametros,
  quitarPrefijo,
} from './resolver';

/**
 * Busca el marcador de ciclo en cualquier profundidad. No se afirma sobre una
 * ruta exacta de anidamiento a proposito: que la expansion se corte en el primer
 * nivel o en el segundo es un detalle de implementacion; lo que importa es que
 * la recursion termine y quede marcado.
 */
function buscarCiclo(nodo: EsquemaCanonico): string | undefined {
  if (nodo.ciclo !== undefined) return nodo.ciclo;
  for (const hijo of Object.values(nodo.propiedades ?? {})) {
    const encontrado = buscarCiclo(hijo);
    if (encontrado !== undefined) return encontrado;
  }
  for (const alternativa of nodo.oneOf ?? []) {
    const encontrado = buscarCiclo(alternativa);
    if (encontrado !== undefined) return encontrado;
  }
  return undefined;
}

// Documento minimo que reproduce, a proposito, las tres condiciones que
// hicieron fallar la version ad-hoc del comparador:
//
//   1. El prefijo /api/v1 de servers[0].url.
//   2. Parametros declarados a nivel de path item, no de operacion.
//   3. Un enum con nombre referenciado desde varias partes.
const FIXTURE = {
  openapi: '3.0.3',
  servers: [{ url: 'http://localhost:3000/api/v1', description: 'Local' }],
  paths: {
    '/api/v1/socios/{socio_id}/membresias': {
      parameters: [{ $ref: '#/components/parameters/SocioId' }],
      get: {
        operationId: 'obtenerMembresia',
        summary: 'Membresía actual del socio',
        tags: ['membresias'],
        responses: {
          '200': {
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Socio' } } },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        operationId: 'modificarMembresia',
        summary: 'Cambiar plan o configuración de la membresía',
        tags: ['membresias'],
        // El unico caso donde la operacion pisa al path item.
        parameters: [{ name: 'socio_id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/MembresiaPatch' } },
          },
        },
        responses: {
          '200': {
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Socio' } } },
          },
        },
      },
    },
  },
  components: {
    parameters: {
      SocioId: { name: 'socio_id', in: 'path', required: true, schema: { type: 'integer' } },
    },
    responses: {
      NotFound: {
        description: 'Recurso no encontrado',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } },
        },
      },
    },
    schemas: {
      Rol: { type: 'string', enum: ['SOCIO', 'EXTERNO', 'GERENTE'] },
      Socio: {
        type: 'object',
        required: ['id', 'rol'],
        properties: {
          id: { type: 'integer', format: 'int32' },
          rol: { $ref: '#/components/schemas/Rol' },
        },
        additionalProperties: false,
      },
      MembresiaPatch: {
        type: 'object',
        properties: { plan: { type: 'string', enum: ['MENSUAL', 'ANUAL'] } },
        additionalProperties: false,
      },
      Problem: { type: 'object', properties: { status: { type: 'integer' } } },
      // Esquema recursivo: el ciclo tiene que cortarse, no colgarse.
      Arbol: {
        type: 'object',
        properties: { hijo: { $ref: '#/components/schemas/Arbol' } },
      },
    },
  },
};

describe('resolver: prefijo de servers', () => {
  // Bug 1 del comparador ad-hoc: no restaba el prefijo, asi que comparaba
  // "/api/v1/socios/..." contra "/socios/..." y daba 38 falsos positivos.
  it('saca la parte de ruta de servers[0].url y la resta de cada operacion', () => {
    const doc = canonicalizarDocumento(FIXTURE);
    expect(doc.prefijo).toBe('/api/v1');
    expect(Object.keys(doc.operaciones).sort()).toEqual([
      'GET /socios/{socio_id}/membresias',
      'PATCH /socios/{socio_id}/membresias',
    ]);
  });

  it('acepta tambien un servers[0].url que ya sea relativo', () => {
    const doc = canonicalizarDocumento({
      servers: [{ url: '/api/v1' }],
      paths: { '/api/v1/sedes': { get: { responses: {} } } },
    });
    expect(doc.prefijo).toBe('/api/v1');
    expect(Object.keys(doc.operaciones)).toEqual(['GET /sedes']);
  });

  it('deja la ruta intacta si no tiene el prefijo', () => {
    expect(quitarPrefijo('/api/v1/socios', '/api/v1')).toBe('/socios');
    expect(quitarPrefijo('/sedes', '/api/v1')).toBe('/sedes');
    expect(quitarPrefijo('/socios', '')).toBe('/socios');
  });
});

describe('resolver: parametros de path item', () => {
  // Bug 2 del comparador ad-hoc: solo miraba parametros dentro de cada
  // operacion, y el contrato declara socio_id una vez a nivel de ruta.
  it('hereda el parametro del path item cuando la operacion no declara ninguno', () => {
    const doc = canonicalizarDocumento(FIXTURE);
    const get = doc.operaciones['GET /socios/{socio_id}/membresias'];
    expect(get.parametros).toEqual([
      { name: 'socio_id', in: 'path', required: true, esquema: { tipo: 'integer' } },
    ]);
  });

  it('la operacion pisa al path item cuando coinciden name + in', () => {
    const doc = canonicalizarDocumento(FIXTURE);
    const patch = doc.operaciones['PATCH /socios/{socio_id}/membresias'];
    expect(patch.parametros).toHaveLength(1);
    expect(patch.parametros[0].esquema.tipo).toBe('string');
  });

  it('fusiona los query params de la operacion con los del path item', () => {
    const ctx = crearContexto({
      components: { parameters: { SocioId: { name: 'socio_id', in: 'path', required: true, schema: { type: 'integer' } } } },
    });
    const fusionados = fusionarParametros(
      [{ $ref: '#/components/parameters/SocioId' }],
      [{ name: 'plan', in: 'query', required: false, schema: { type: 'string' } }],
      ctx,
    );
    expect(fusionados.map((p) => `${p.in}:${p.name}`).sort()).toEqual([
      'path:socio_id',
      'query:plan',
    ]);
  });
});

describe('resolver: diferencias de representacion se normalizan', () => {
  it('un enum con nombre y el mismo enum inline quedan canonicos identicos', () => {
    const doc = canonicalizarDocumento(FIXTURE);
    const porNombre = canonicalizarEsquema(
      { $ref: '#/components/schemas/Rol' },
      crearContexto(FIXTURE),
    );
    // Distinto orden a proposito: el orden de un enum no es normativo.
    const inline = canonicalizarEsquema(
      { type: 'string', enum: ['GERENTE', 'SOCIO', 'EXTERNO'] },
      crearContexto(FIXTURE),
    );
    expect(porNombre).toEqual(inline);
    expect(porNombre.enum).toEqual(['EXTERNO', 'GERENTE', 'SOCIO']);
    expect(doc.esquemas.Rol.enum).toEqual(['EXTERNO', 'GERENTE', 'SOCIO']);
  });

  it('required se ordena como conjunto, no como secuencia', () => {
    const a = canonicalizarEsquema({ required: ['id', 'rol'] }, crearContexto({}));
    const b = canonicalizarEsquema({ required: ['rol', 'id'] }, crearContexto({}));
    expect(a).toEqual(b);
  });

  it('una respuesta $ref y la misma respuesta inline quedan canonicas identicas', () => {
    const doc = canonicalizarDocumento(FIXTURE);
    const porRef = doc.operaciones['GET /socios/{socio_id}/membresias'].respuestas['404'];
    const inline = {
      contenido: {
        'application/problem+json': {
          tipo: 'object',
          propiedades: { status: { tipo: 'integer' } },
        },
      },
    };
    expect(porRef).toEqual(inline);
  });
});

describe('resolver: nunca tira', () => {
  it('un $ref a un destino inexistente se marca, no explota', () => {
    const ctx = crearContexto({ components: { schemas: {} } });
    expect(canonicalizarEsquema({ $ref: '#/components/schemas/NoExiste' }, ctx)).toEqual({
      noResuelto: '#/components/schemas/NoExiste',
    });
  });

  it('un ciclo se corta con un marcador en vez de colgarse', () => {
    const doc = canonicalizarDocumento(FIXTURE);
    expect(buscarCiclo(doc.esquemas.Arbol)).toBe('#/components/schemas/Arbol');
  });

  it('tipos de dato inesperados se ignoran sin romper nada', () => {
    const ctx = crearContexto({});
    expect(() =>
      canonicalizarEsquema(
        {
          type: 42,
          properties: 'esto no es un objeto',
          required: 'tampoco un array',
          enum: { nope: true },
        },
        ctx,
      ),
    ).not.toThrow();
    expect(canonicalizarEsquema(undefined, ctx)).toEqual({});
    expect(canonicalizarEsquema('basura', ctx)).toEqual({});
    expect(canonicalizarEsquema([1, 2, 3], ctx)).toEqual({});
  });

  it('un documento entero vacio o basura produce un canonico vacio', () => {
    expect(canonicalizarDocumento(undefined).operaciones).toEqual({});
    expect(canonicalizarDocumento({}).esquemas).toEqual({});
    expect(canonicalizarDocumento('nada').prefijo).toBe('');
  });

  it('un parametro $ref roto se reporta con el nombre del ref', () => {
    const ctx = crearContexto({ components: { parameters: {} } });
    const fusionados = fusionarParametros([{ $ref: '#/components/parameters/Fantasma' }], [], ctx);
    expect(fusionados[0].esquema.noResuelto).toBe('#/components/parameters/Fantasma');
  });
});
