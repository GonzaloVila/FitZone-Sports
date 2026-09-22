import process from 'node:process';

// Carga las variables de entorno de test (Postgres en Docker) ANTES de que
// se instancie cualquier modulo de Nest. Nunca usar .env (Supabase
// compartida) para los tests e2e.
process.loadEnvFile(new URL('../.env.test', import.meta.url));
