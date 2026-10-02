import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * La copia canonica del contrato vive en el repo: `contrato/openapi.yaml`.
 * Antes vivia solo en el vault, fuera del repo, y eso hacia que un cambio de
 * contrato nociera en el PR y que Git no se enterara si el codigo se separaba
 * de el. Ahora el sentido es uno solo: se edita el repo y el YAML del vault se
 * genera desde aca.
 *
 * El riesgo que queda es el contrario de una desincronizacion silenciosa: que
 * uno edite el repo, se le pase exportar y entregue un vault viejo. `verificar`
 * es para eso, y es lo que hay que correr antes de entregar.
 */

/** Raiz del backend, sin depender del cwd desde el que se invoque. */
const BACKEND = resolve(import.meta.dirname, '..');

export const RUTA_CANONICA = resolve(BACKEND, 'contrato', 'openapi.yaml');

/**
 * Donde vive el entregable del vault. Es una maquina concreta, asi que la ruta
 * tiene un default pero se puede pisar con FITZONE_VAULT_CONTRATO para no
 * dejarla grabada en el codigo en ningun otro lado.
 */
export const RUTA_VAULT =
  process.env.FITZONE_VAULT_CONTRATO ??
  'C:\\Users\\GAMER\\Documents\\Facultad\\Programacion V\\TFI\\TFI FitZone - OpenAPI.yaml';

/** Registro del vault: SHA de lo que se exporto y cuando. */
const RUTA_MANIFIESTO = resolve(BACKEND, 'contrato', 'vault-exportado.json');

export function sha256(ruta: string): string {
  return createHash('sha256').update(readFileSync(ruta)).digest('hex');
}

type Manifiesto = {
  vault: string;
  sha256: string;
  exportado: string;
};

export function leerManifiesto(): Manifiesto | undefined {
  if (!existsSync(RUTA_MANIFIESTO)) return undefined;
  try {
    return JSON.parse(readFileSync(RUTA_MANIFIESTO, 'utf8')) as Manifiesto;
  } catch {
    return undefined;
  }
}

/**
 * Copia el canonico al vault y anota el SHA. Si el destino no existe se reporta
 * como error en vez de crearlo en cualquier lado: el path del vault viene del
 * default o de una variable de entorno, y adivinar ahi es peor que fallar.
 */
export function exportar(): { sha: string; destino: string; anterior: string } {
  if (!existsSync(RUTA_CANONICA)) {
    throw new Error(`No existe el contrato canonico en ${RUTA_CANONICA}`);
  }
  if (!existsSync(RUTA_VAULT)) {
    throw new Error(
      `No existe el destino del vault en ${RUTA_VAULT}.\n` +
        'Si el vault esta en otro lado, pasalo por entorno:\n' +
        '  $env:FITZONE_VAULT_CONTRATO = "C:\\ruta\\TFI FitZone - OpenAPI.yaml"',
    );
  }

  const anterior = sha256(RUTA_VAULT);
  const sha = sha256(RUTA_CANONICA);
  copyFileSync(RUTA_CANONICA, RUTA_VAULT);
  const manifiesto: Manifiesto = { vault: RUTA_VAULT, sha256: sha, exportado: new Date().toISOString() };
  writeFileSync(RUTA_MANIFIESTO, JSON.stringify(manifiesto, null, 2) + '\n', 'utf8');

  return { sha, destino: RUTA_VAULT, anterior };
}

/**
 * Compara los tres estados posibles. Que el vault difiera del canonico es el caso
 * que importa, y que difiera del ultimo export registrado significa que el vault
 * cambio por fuera, o sea que alguien edito el entregable en vez de editar el repo.
 * Que coincidan los dos y no haya manifiesto solo pasa la primera vez, antes de
 * que exista la linea base.
 */
export function verificar(): {
  ok: boolean;
  canonico: string;
  vault: string | undefined;
  ultimaExportacion: Manifiesto | undefined;
  motivo: string;
} {
  const canonico = sha256(RUTA_CANONICA);
  const vault = existsSync(RUTA_VAULT) ? sha256(RUTA_VAULT) : undefined;
  const ultimaExportacion = leerManifiesto();

  if (!vault) {
    return {
      ok: false,
      canonico,
      vault,
      ultimaExportacion,
      motivo: `no existe el vault en ${RUTA_VAULT}. Correr: npm run contrato:exportar`,
    };
  }

  if (vault !== canonico) {
    const detalle = ultimaExportacion
      ? `Ultima exportacion registrada: ${ultimaExportacion.exportado}.`
      : 'No hay registro de ninguna exportacion previa.';
    return {
      ok: false,
      canonico,
      vault,
      ultimaExportacion,
      motivo: `el vault no coincide con el canonico. ${detalle} Correr: npm run contrato:exportar`,
    };
  }

  if (!ultimaExportacion) {
    return {
      ok: false,
      canonico,
      vault,
      ultimaExportacion,
      motivo:
        'los dos archivos coinciden pero no hay linea base registrada, asi que no se puede saber si alguien ' +
        'toco el vault a mano. Correr: npm run contrato:exportar',
    };
  }

  if (ultimaExportacion.sha256 !== canonico) {
    return {
      ok: false,
      canonico,
      vault,
      ultimaExportacion,
      motivo:
        'los dos archivos coinciden, pero el manifiesto registra otro SHA: el vault se toco a mano despues ' +
        'del ultimo export y la trazabilidad ya no sirve. Correr: npm run contrato:exportar',
    };
  }

  return { ok: true, canonico, vault, ultimaExportacion, motivo: 'el vault coincide con el canonico.' };
}

// CLI: `node --experimental-strip-types contrato/exportar.ts [exportar|verificar]`
const esEntry = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (esEntry) {
  const modo = process.argv[2] ?? 'verificar';

  if (modo === 'exportar') {
    const { sha, destino, anterior } = exportar();
    console.log(`exportado a ${destino}`);
    console.log(`  sha256 ${sha}`);
    if (anterior !== sha) console.log(`  (el vault estaba en ${anterior})`);
  } else if (modo === 'verificar') {
    const r = verificar();
    console.log(`canonico ${RUTA_CANONICA}`);
    console.log(`vault     ${r.vault ?? '(no existe)'}`);
    console.log(r.motivo);
    process.exit(r.ok ? 0 : 1);
  } else {
    console.error(`Modo desconocido: ${modo}. Usar exportar|verificar`);
    process.exit(2);
  }
}