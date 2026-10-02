import process from 'node:process';

// Reusa el mismo archivo de entorno que los e2e. Esta herramienta es local y no
// versionada, asi que lee la config desde el mismo lugar que ya funciona: las
// dos rutas que necesita (el documento servido y el contrato) viven en
// backend/.env.test, que esta gitignored a proposito.
//
// No se usa .env: ahi esta la Supabase compartida y esta herramienta no necesita
// base de datos para nada. Solo lee un JSON por HTTP.
process.loadEnvFile(new URL('../.env.test', import.meta.url));
