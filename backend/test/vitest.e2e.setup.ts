import process from 'node:process';

// Carga las variables de entorno de test ANTES de que se instancie cualquier
// modulo de Nest. Por defecto es el Postgres local de .env.test.
//
// process.loadEnvFile NO pisa variables ya definidas, asi que un DATABASE_URL
// exportada antes de correr el test manda sobre .env.test. Eso permite apuntar
// los e2e a otra base, pero no por accidente: si el host resuelto no es local,
// el run se corta salvo que se pida explicito con FITZONE_E2E_ALLOW_REMOTE=1.
// Los tests insertan fixtures y los borran despues, asi que una base compartida
// no se rompe, pero si queda escrita.
process.loadEnvFile(new URL('../.env.test', import.meta.url));

const dbUrl = process.env.DATABASE_URL ?? '';
const esLocal = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(dbUrl);

if (!esLocal && process.env.FITZONE_E2E_ALLOW_REMOTE !== '1') {
  throw new Error(
    'Los e2e van a correr contra una base que no es local. ' +
      'Para confirmarlo, exporta FITZONE_E2E_ALLOW_REMOTE=1. ' +
      'Los tests insertan fixtures y los borran despues, pero escriben en la base de destino.',
  );
}
