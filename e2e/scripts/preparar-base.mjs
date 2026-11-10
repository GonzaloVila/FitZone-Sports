// Deja lista la base de las pruebas E2E antes de cada corrida:
//   1. levanta el Postgres de pruebas (docker-compose.test.yml, puerto 55432);
//   2. crea la base `fitzone_e2e` si no existe (separada de `fitzone_test`, la de integración y API);
//   3. aplica las migraciones de Prisma;
//   4. carga el seed (docs/db/seed_supabase_test_data.sql), que vacía las tablas y vuelve a insertar los datos de prueba.
// Cada corrida arranca así desde el mismo estado. Nunca toca la base compartida de Supabase: la URL es fija y local.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const raiz = fileURLToPath(new URL('../..', import.meta.url))
const backend = path.join(raiz, 'backend')
const CONTENEDOR = 'fitzone-postgres-test'
const BASE = 'fitzone_e2e'
export const URL_BASE_E2E = `postgresql://fitzone:fitzone@localhost:55432/${BASE}?schema=public`

function correr(comando, argumentos, opciones = {}) {
  execFileSync(comando, argumentos, { stdio: 'inherit', ...opciones })
}

function salida(comando, argumentos) {
  return execFileSync(comando, argumentos, { encoding: 'utf8' }).trim()
}

console.log('· Levantando el Postgres de pruebas (Docker)…')
try {
  correr('docker', ['compose', '-f', path.join(raiz, 'docker-compose.test.yml'), 'up', '-d', '--wait'])
} catch {
  console.error('\nNo se pudo levantar el contenedor. ¿Está abierto Docker Desktop?\n')
  process.exit(1)
}

const existe = salida('docker', [
  'exec',
  CONTENEDOR,
  'psql',
  '-U',
  'fitzone',
  '-d',
  'fitzone_test',
  '-tAc',
  `SELECT 1 FROM pg_database WHERE datname = '${BASE}'`,
])
if (existe !== '1') {
  console.log(`· Creando la base ${BASE}…`)
  correr('docker', ['exec', CONTENEDOR, 'createdb', '-U', 'fitzone', BASE])
}

const prisma = path.join(backend, 'node_modules', 'prisma', 'build', 'index.js')
const entorno = { ...process.env, DATABASE_URL: URL_BASE_E2E, PRISMA_HIDE_UPDATE_MESSAGE: '1' }

console.log('· Aplicando migraciones…')
correr(process.execPath, [prisma, 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], { cwd: backend, env: entorno })

console.log('· Cargando el seed…')
correr(
  process.execPath,
  [prisma, 'db', 'execute', '--url', URL_BASE_E2E, '--file', path.join(raiz, 'docs', 'db', 'seed_supabase_test_data.sql')],
  { cwd: backend, env: entorno },
)

console.log('· Base E2E lista.\n')
