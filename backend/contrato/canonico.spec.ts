import { existsSync, readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { RUTA_CANONICA, RUTA_VAULT, sha256, verificar } from './exportar';

/**
 * La mitad del contrato que se puede verificar sin servidor.
 *
 * `contrato.spec.ts` necesita el backend arriba porque compara el YAML contra el
 * documento que publica el codigo. Eso lo hace el comparador de verdad, y es lo
 * importante, pero solo corre si alguien se acuerda de levantar el server.
 *
 * Lo de aqui es lo que no necesita server y por eso no se puede postergar: que
 * `contrato/openapi.yaml` sea un documento valido, y que la copia del vault sea
 * ese mismo archivo. Con el canonico en el repo, el modo de falla que queda no es
 * que el codigo se desincronice del contrato, sino que uno edite el repo, se le
 * pase exportar y entregue un vault viejo. Este spec es el que avisa.
 */

describe('contrato: la copia canonica del repo', () => {
  it('existe y es un documento OpenAPI parseable', () => {
    expect(existsSync(RUTA_CANONICA), `falta ${RUTA_CANONICA}`).toBe(true);

    const doc = load(readFileSync(RUTA_CANONICA, 'utf8')) as Record<string, unknown>;

    expect(doc.openapi, 'falta el campo openapi').toMatch(/^3\./);
    expect(doc.info, 'falta info').toBeTypeOf('object');
    expect(doc.paths, 'falta paths').toBeTypeOf('object');
    expect(Object.keys(doc.paths as object).length).toBeGreaterThan(0);
  });

  it('tiene declarada la respuesta 422 en los PATCH que aceptan body parcial', () => {
    // Los cuatro PATCH de la API tienen DTOs con todos los campos opcionales, asi
    // que un body {} los atraviesa entero. El service corta con 422 y el contrato
    // tiene que declararlo; si alguno pierde el 422 el comparador del server lo
    // detecta, pero solo cuando alguien lo levanta.
    const doc = load(readFileSync(RUTA_CANONICA, 'utf8')) as {
      paths: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
    };

    const patch = [
      '/usuarios/{id}',
      '/socios/{socio_id}',
      '/socios/{socio_id}/membresias',
      '/canchas/{cancha_id}',
    ];

    for (const ruta of patch) {
      const respuestas = doc.paths[ruta]?.patch?.responses;
      expect(respuestas, `falta la operacion PATCH ${ruta}`).toBeTypeOf('object');
      expect(respuestas, `PATCH ${ruta} no declara 422`).toHaveProperty('422');
    }
  });
});

describe('contrato: el vault no quedó viejo', () => {
  it('la copia del vault coincide con la del repo', () => {
    if (!existsSync(RUTA_VAULT)) {
      // El vault es un entregable de esta maquina. Que no este en un CI no es un
      // fallo del spec, asi que se avisa y se sigue.
      console.log(`\n  vault ausente en ${RUTA_VAULT}: nada que verificar en esta maquina`);
      return;
    }

    const r = verificar();

    expect(r.vault, r.motivo).toBe(sha256(RUTA_CANONICA));
  });

  it('el manifiesto de exportacion corresponde al archivo que hay', () => {
    if (!existsSync(RUTA_VAULT)) return;

    const r = verificar();

    // Si coincide pero el manifiesto dice otro SHA, alguien edito el entregable en
    // el vault en vez de editar el repo: el archivo esta bien y la trazabilidad ya
    // no sirve, asi que tambien se falla.
    expect(
      r.ultimaExportacion?.sha256,
      `${r.motivo}\n  Correr: npm run contrato:exportar`,
    ).toBe(sha256(RUTA_CANONICA));
  });
});