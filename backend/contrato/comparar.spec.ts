import { describe, expect, it } from 'vitest';
import { PERMITIDAS, aplicarPermitidas, compararDocumentos } from './comparar';
import { canonicalizarDocumento } from './resolver';

/**
 * Par de documentos SEMANTICAMENTE IDENTICOS pero escritos distinto, que es
 * exactamente el caso que hacia ruido la primera vez:
 *
 *   - el enum Plan es un schema con nombre en el contrato y va inline en el codigo;
 *   - la respuesta 404 va por $ref en el contrato y escrita en el lugar en el codigo;
 *   - el parametro socio_id vive a nivel de ruta en el contrato y en la operacion
 *     en el codigo;
 *   - el enum esta declarado en distinto orden.
 *
 * Compararlos tiene que dar CERO. Si algo aparece aca, el comparador esta
 * mirando diferencias de representacion como si fueran errores.
 */
const CONTRATO = {
  openapi: '3.0.3',
  servers: [{ url: 'http://localhost:3000/api/v1' }],
  paths: {
    '/api/v1/socios/{socio_id}/membresias': {
      parameters: [{ $ref: '#/components/parameters/SocioId' }],
      get: {
        operationId: 'obtenerMembresia',
        summary: 'Membresía actual del socio',
        tags: ['membresias'],
        responses: {
          '200': {
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/MembresiaOut' } },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
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
      Plan: { type: 'string', enum: ['MENSUAL', 'ANUAL'] },
      MembresiaOut: {
        type: 'object',
        required: ['id', 'plan'],
        properties: {
          id: { type: 'integer' },
          plan: { $ref: '#/components/schemas/Plan' },
        },
      },
      Problem: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'integer' } },
      },
    },
  },
};

const CODIGO = {
  servers: [{ url: 'http://localhost:3000/api/v1' }],
  paths: {
    '/api/v1/socios/{socio_id}/membresias': {
      get: {
        operationId: 'obtenerMembresia',
        summary: 'Membresía actual del socio',
        tags: ['membresias'],
        parameters: [{ name: 'socio_id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['id', 'plan'],
                  properties: {
                    id: { type: 'integer' },
                    plan: { type: 'string', enum: ['ANUAL', 'MENSUAL'] },
                  },
                },
              },
            },
          },
          '404': {
            content: {
              'application/problem+json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: { status: { type: 'integer' } },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      MembresiaOut: {
        type: 'object',
        required: ['id', 'plan'],
        properties: {
          id: { type: 'integer' },
          plan: { type: 'string', enum: ['ANUAL', 'MENSUAL'] },
        },
      },
      Problem: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'integer' } },
      },
    },
  },
};

function comparar(contrato: unknown, codigo: unknown) {
  const hallazgos = compararDocumentos(canonicalizarDocumento(contrato), canonicalizarDocumento(codigo));
  return aplicarPermitidas(hallazgos);
}

function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

describe('comparar: diferencias de representacion no son errores', () => {
  it('dos documentos identicos salvo la forma de escribirlos dan cero hallazgos', () => {
    const { efectivos, silenciados } = comparar(CONTRATO, CODIGO);
    expect(efectivos).toEqual([]);
    // Lo unico que queda silenciado es el enum con nombre que el codigo no
    // materializa como schema, que esta justificado con su motivo.
    expect(silenciados.map((s) => s.clave)).toEqual(['esquema-falta:Plan']);
    expect(silenciados[0].motivo).toContain('inline');
  });
});

describe('comparar: control de mutacion', () => {
  /**
   * El motivo de este test: un "0 diferencias" que sale por un bug del script es
   * peor que no medir, porque se reporta como confianza. Rompemos el documento
   * del codigo en tres puntos y exigimos que se reporten ESOS tres y nada mas.
   * Si el documento roto devolviera 0, este test falla.
   */
  it('detecta exactamente las tres diferencias que se le inyectan', () => {
    const roto = clonar(CODIGO);

    // 1. Se cae un required.
    roto.components.schemas.MembresiaOut.required = ['plan'];

    // 2. El codigo expone un codigo de respuesta que el contrato no declara.
    roto.paths['/api/v1/socios/{socio_id}/membresias'].get.responses['418'] = {
      content: { 'application/json': { schema: { type: 'object' } } },
    };

    // 3. Un $ref que no lleva a ninguna parte.
    roto.paths['/api/v1/socios/{socio_id}/membresias'].get.responses['200'].content[
      'application/json'
    ].schema = { $ref: '#/components/schemas/NoExiste' };

    const { efectivos } = comparar(CONTRATO, roto);

    expect(efectivos).toHaveLength(3);
    expect(efectivos.map((h) => h.clave).sort()).toEqual([
      'esquema:MembresiaOut.requeridas',
      'resp-sobra:GET /socios/{socio_id}/membresias:418',
      'resp:200.application/json.noResuelto',
    ]);
  });

  it('no reporta diferencias cuando no hay diferencias', () => {
    // La contraparte del control: el par limpio tiene que seguir dando cero,
    // para que un fallo del test anterior no sea "todo esta roto".
    const { efectivos } = comparar(CONTRATO, CODIGO);
    expect(efectivos).toHaveLength(0);
  });
});

describe('comparar: deteccion de desalineaciones reales', () => {
  it('una operacion que falta en el codigo se reporta', () => {
    const sinPatch = clonar(CODIGO);
    delete (sinPatch.paths['/api/v1/socios/{socio_id}/membresias'] as Record<string, unknown>).patch;

    const conPatch = clonar(CONTRATO);
    conPatch.paths['/api/v1/socios/{socio_id}/membresias'].patch = {
      operationId: 'modificarMembresia',
      summary: 'Cambiar plan o configuración de la membresía',
      tags: ['membresias'],
      responses: { '200': { content: { 'application/json': { schema: { type: 'object' } } } } },
    };

    const { efectivos } = comparar(conPatch, sinPatch);
    expect(efectivos.map((h) => h.clave)).toEqual([
      'op-falta:PATCH /socios/{socio_id}/membresias',
    ]);
  });

  it('una propiedad de mas en el codigo se reporta', () => {
    const conExceso = clonar(CODIGO);
    conExceso.components.schemas.MembresiaOut.properties = {
      id: { type: 'integer' },
      plan: { type: 'string', enum: ['ANUAL', 'MENSUAL'] },
      razon_baja: { type: 'string' },
    };

    const { efectivos } = comparar(CONTRATO, conExceso);
    expect(efectivos.map((h) => h.clave)).toEqual([
      'esquema:MembresiaOut.prop-sobra:razon_baja',
    ]);
  });

  it('un enum con menos valores se reporta con el detalle de cuales faltan', () => {
    const conEnumCorto = clonar(CODIGO);
    conEnumCorto.components.schemas.MembresiaOut.properties.plan.enum = ['MENSUAL'];

    const { efectivos } = comparar(CONTRATO, conEnumCorto);
    expect(efectivos).toHaveLength(1);
    expect(efectivos[0].clave).toBe('esquema:MembresiaOut.prop:plan.enum');
    expect(efectivos[0].detalle).toContain('ANUAL');
  });

  it('un summary distinto se reporta', () => {
    const otroSummary = clonar(CODIGO);
    otroSummary.paths['/api/v1/socios/{socio_id}/membresias'].get.summary = 'Membresia del socio';

    const { efectivos } = comparar(CONTRATO, otroSummary);
    expect(efectivos.map((h) => h.clave)).toEqual([
      'summary:GET /socios/{socio_id}/membresias',
    ]);
  });

  it('la ruta de un hallazgo es siempre la clave de operacion o el nombre del schema', () => {
    // Regresion: antes un hallazgo de respuesta llegaba con la ruta
    // "GET /x -> 200" y otro de la misma operacion con "GET /x". Con dos rutas
    // distintas para el mismo lugar, el agrupado por modulo y la allowlist
    // groupings fallaban en silencio.
    const conIdMalTipado = clonar(CODIGO);
    (conIdMalTipado.paths['/api/v1/socios/{socio_id}/membresias'].get.responses['200']
      .content['application/json'].schema as { properties: Record<string, unknown> }).properties.id =
      { type: 'string' };

    const { efectivos } = comparar(CONTRATO, conIdMalTipado);
    expect(efectivos.length).toBeGreaterThan(0);
    for (const h of efectivos) {
      expect(h.ruta, `ruta con sufijo de codigo de estado: ${h.ruta}`).not.toMatch(/->\s*\d{3}$/);
      expect(
        h.ruta.startsWith('GET /socios/{socio_id}/membresias') ||
          ['MembresiaOut', 'SocioOut', 'MembresiaPatch', 'Problem'].includes(h.ruta),
        `ruta inesperada: ${h.ruta}`,
      ).toBe(true);
    }
  });
});

describe('comparar: la lista de permitidas silencia de forma exacta', () => {
  it('no silencia un hallazgo cuya clave no esta en la lista', () => {
    const conExceso = clonar(CODIGO);
    conExceso.components.schemas.MembresiaOut.properties = {
      id: { type: 'integer' },
      plan: { type: 'string', enum: ['ANUAL', 'MENSUAL'] },
      razon_baja: { type: 'string' },
    };

    const { efectivos, silenciados } = comparar(CONTRATO, conExceso);
    expect(efectivos.map((h) => h.clave)).toEqual(['esquema:MembresiaOut.prop-sobra:razon_baja']);
    expect(silenciados.map((s) => s.clave)).toEqual(['esquema-falta:Plan']);
  });

  it('cada entrada de la lista tiene un motivo escrito', () => {
    for (const p of PERMITIDAS) {
      expect(p.motivo.length).toBeGreaterThan(20);
    }
  });

  it('no aplica comodines: una clave parecida pero distinta no se silencia', () => {
    const conExceso = clonar(CODIGO);
    conExceso.components.schemas.MembresiaOut.properties = {
      id: { type: 'integer' },
      plan: { type: 'string', enum: ['ANUAL', 'MENSUAL'] },
      razon_baja: { type: 'string' },
    };

    const conListaTrampa = aplicarPermitidas(
      compararDocumentos(canonicalizarDocumento(CONTRATO), canonicalizarDocumento(conExceso)),
      [{ clave: 'esquema:MembresiaOut.prop-sobra', motivo: 'entrada mal escrita a proposito' }],
    );
    expect(conListaTrampa.efectivos).toHaveLength(2);
  });
});
