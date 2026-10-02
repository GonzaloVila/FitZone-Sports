import fs from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { calcularAlcance } from './alcance';
import { aplicarPermitidas, compararDocumentos } from './comparar';
import type { Hallazgo } from './comparar';
import { canonicalizarDocumento } from './resolver';

/**
 * El contrato canonico esta versionado en `contrato/openapi.yaml`, asi que la
 * variable de entorno ya no hace falta para el lado del contrato: si no se pasa,
 * se usa la copia del repo. Antes apuntaba al YAML del vault, que vive fuera del
 * repo y por lo tanto no podia desincronizarse sin que nadie lo notara.
 *
 * La URL del backend si sigue siendo obligatoria: sin servidor levantado no hay
 * documento contra el cual comparar, y un comparador que no comparo nada
 * tiene que decir "falta el server", no pasar en verde.
 */
const RUTA_CONTRATO = process.env.FITZONE_CONTRACT_PATH ?? resolve(import.meta.dirname, 'openapi.yaml');
const URL_DOCUMENTO = process.env.FITZONE_CONTRATO_URL;

const SIN_SERVER = !URL_DOCUMENTO;

let documentoContrato: unknown;
let documentoCodigo: unknown;
let errorDeCarga: string | undefined;

const seSalta = () => SIN_SERVER || errorDeCarga !== undefined;

/**
 * Levanta los dos documentos. Cualquier problema de infraestructura (el server
 * no esta arriba, el YAML no se puede leer) queda como mensaje y produce un skip,
 * nunca una excepcion: un comparador que se cae no dice nada, y lo que hay que
 * decir es "arranca el server", no un stack de Node.
 *
 * El skip es solo por el servidor. La otra mitad del problema, que el YAML del
 * repo y el del vault sean el mismo, no necesita servidor y por eso vive en
 * `canonico.spec.ts`, que corre siempre.
 */
beforeAll(async () => {
  if (SIN_SERVER) return;

  try {
    documentoContrato = (await import('js-yaml')).load(
      fs.readFileSync(RUTA_CONTRATO as string, 'utf8'),
    );
  } catch (error) {
    errorDeCarga = `No se pudo leer el contrato en ${RUTA_CONTRATO}: ${
      error instanceof Error ? error.message : String(error)
    }`;
    return;
  }

  try {
    const respuesta = await fetch(URL_DOCUMENTO as string);
    if (!respuesta.ok) {
      errorDeCarga = `El backend respondio ${respuesta.status} en ${URL_DOCUMENTO}.`;
      return;
    }
    documentoCodigo = await respuesta.json();
  } catch (error) {
    errorDeCarga =
      `No se pudo leer ${URL_DOCUMENTO}. Arrancá el backend con "npm run start:dev" ` +
      `en otra terminal. Detalle: ${error instanceof Error ? error.message : String(error)}`;
  }
});

function imprimir(hallazgos: Hallazgo[], titulo: string): void {
  console.log(`\n  ${titulo}: ${hallazgos.length}`);
  for (const h of hallazgos) {
    console.log(`    [${h.tipo}] ${h.ruta}`);
    console.log(`        ${h.detalle}`);
    console.log(`        clave: ${h.clave}`);
  }
}

/**
 * Agrupa los hallazgos por modulo del contrato, asi se lee "que debe corregir
 * cada parte del equipo" en vez de una lista de 100 lineas. Un schema se
 * atribuye a los tags de las operaciones que lo usan, asi que puede aparecer en
 * mas de un grupo.
 */
function imprimirPorModulo(hallazgos: Hallazgo[], alcance: ReturnType<typeof calcularAlcance>): void {
  const grupos = new Map<string, Hallazgo[]>();
  for (const h of hallazgos) {
    // `ruta` llega con varias formas: "GET /x" (operacion), "GET /x.id" (campo de
    // una respuesta), "GET /x?page" (parametro), "POST /x (body)" (cuerpo) o
    // el nombre del schema. Se recorta hasta la clave de operacion o el schema
    // para atribuir el hallazgo a un modulo.
    const base = h.ruta
      .replace(/->\s*\d{3}$/, '')
      .split('?')[0]
      .split('.')[0]
      .replace(/\s*\([^)]*\)$/, '')
      .replace(/\[[^\]]*\]$/, '');
    const esOperacion = /^(GET|POST|PATCH|PUT|DELETE) /.test(base);
    const modulos = esOperacion
      ? [alcance.moduloDeOperacion[base] ?? `(sin tag: ${base})`]
      : (alcance.modulosDeEsquema[base] ?? ['(sin uso)']);
    for (const modulo of modulos) {
      const lista = grupos.get(modulo) ?? [];
      lista.push(h);
      grupos.set(modulo, lista);
    }
  }

  console.log(`\n  diferencias por modulo: ${hallazgos.length}`);
  for (const [modulo, lista] of [...grupos].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  == ${modulo} (${lista.length}) ==`);
    for (const h of lista) {
      console.log(`    [${h.tipo}] ${h.ruta}`);
      console.log(`        ${h.detalle}`);
    }
  }
}

describe('contrato: el backend publica lo que el contrato declara', () => {
  it.skipIf(seSalta())('no hay diferencias de contrato', () => {
    expect(errorDeCarga).toBeUndefined();

    const contratoCanonico = canonicalizarDocumento(documentoContrato);
    // El prefijo lo manda el contrato; se le fuerza al documento del codigo
    // porque el suyo viene con servers vacio.
    const codigoCanonico = canonicalizarDocumento(documentoCodigo, contratoCanonico.prefijo);

    const alcance = calcularAlcance(documentoContrato, documentoCodigo);
    const { efectivos, silenciados } = aplicarPermitidas(
      compararDocumentos(contratoCanonico, codigoCanonico, {
        operaciones: alcance.operaciones,
        esquemas: alcance.esquemas,
      }),
    );

    console.log(`\n  modulos implementados: ${alcance.modulosImplementados.join(', ')}`);
    console.log(`  a comparar: ${alcance.operaciones.length} operaciones, ${alcance.esquemas.length} schemas`);
    console.log(
      `  fuera de alcance (aun no implementado): ${alcance.pendientes.length} operaciones, ` +
        `${alcance.esquemasPendientes.length} schemas`,
    );

    for (const s of silenciados) {
      console.log(`\n  diferencia aceptada a proposito [${s.clave}]`);
      console.log(`      ${s.motivo}`);
    }

    imprimirPorModulo(efectivos, alcance);

    if (efectivos.length > 0) {
      console.log(
        '\n  Para aceptar una diferencia a proposito, agregala en contrato/comparar.ts\n' +
          '  dentro de PERMITIDAS, con la regla del contrato que la justifica.\n',
      );
    }

    expect(efectivos.map((h) => h.clave)).toEqual([]);
  });
});

describe('contrato: M1 esta alineado y no debe volver a desalinearse', () => {
  it.skipIf(seSalta())('usuarios, socios y membresias no tienen diferencias', () => {
    const contratoCanonico = canonicalizarDocumento(documentoContrato);
    const codigoCanonico = canonicalizarDocumento(documentoCodigo, contratoCanonico.prefijo);
    const alcance = calcularAlcance(documentoContrato, documentoCodigo);

    const { efectivos } = aplicarPermitidas(
      compararDocumentos(contratoCanonico, codigoCanonico, {
        operaciones: alcance.operaciones,
        esquemas: alcance.esquemas,
      }),
    );

    // El agrupado tiene que cubrir el 100% de los hallazgos, si no "M1 esta
    // limpio" seria solo una consecuencia de que los hallazgos se perdieran.
    for (const h of efectivos) {
      const base = h.ruta.replace(/->\s*\d{3}$/, '').split('?')[0].split('.')[0]
        .replace(/\s*\([^)]*\)$/, '').replace(/\[[^\]]*\]$/, '');
      const esOperacion = /^(GET|POST|PATCH|PUT|DELETE) /.test(base);
      const modulos = esOperacion
        ? [alcance.moduloDeOperacion[base]]
        : (alcance.modulosDeEsquema[base] ?? []);
      expect(modulos, `hallazgo sin modulo, no se puede afirmar nada de el: ${h.clave}`)
        .not.toContain(undefined);
    }

    const deM1 = efectivos.filter((h) => {
      const base = h.ruta.replace(/->\s*\d{3}$/, '').split('?')[0].split('.')[0]
        .replace(/\s*\([^)]*\)$/, '').replace(/\[[^\]]*\]$/, '');
      const esOperacion = /^(GET|POST|PATCH|PUT|DELETE) /.test(base);
      const modulos = esOperacion
        ? [alcance.moduloDeOperacion[base]]
        : (alcance.modulosDeEsquema[base] ?? []);
      return modulos.some((m) => m === 'usuarios' || m === 'socios' || m === 'membresias');
    });

    console.log(
      `\n  M1 (usuarios, socios, membresias): ${deM1.length} diferencias de ` +
        `${efectivos.length} totales`,
    );
    for (const h of deM1) console.log(`    [${h.tipo}] ${h.clave}\n        ${h.detalle}`);

    expect(deM1.map((h) => h.clave)).toEqual([]);
  });
});

describe('contrato: la herramienta se puede correr', () => {  it.skipIf(seSalta())('los dos documentos se leen y el alcance se calcula', () => {
    const contratoCanonico = canonicalizarDocumento(documentoContrato);
    const codigoCanonico = canonicalizarDocumento(documentoCodigo, contratoCanonico.prefijo);

    console.log(
      `\n  contrato: ${Object.keys(contratoCanonico.esquemas).length} schemas, ` +
        `${Object.keys(contratoCanonico.operaciones).length} operaciones, prefijo ${contratoCanonico.prefijo}`,
    );
    console.log(
      `  backend:  ${Object.keys(codigoCanonico.esquemas).length} schemas, ` +
        `${Object.keys(codigoCanonico.operaciones).length} operaciones, prefijo ${codigoCanonico.prefijo}`,
    );

    const alcance = calcularAlcance(documentoContrato, documentoCodigo);
    expect(alcance.operaciones.length).toBeGreaterThan(0);
    // Las operaciones a comparar tienen que existir de los dos lados, si no el
    // filtro estaria vacio y el comparadoraria verde por no mirar nada.
    for (const clave of alcance.operaciones) {
      expect(contratoCanonico.operaciones[clave], `falta en contrato: ${clave}`).toBeDefined();
    }
    expect(alcance.pendientes.length + alcance.operaciones.length).toBe(
      Object.keys(contratoCanonico.operaciones).length,
    );
  });
});
