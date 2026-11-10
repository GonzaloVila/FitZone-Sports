import { defineConfig, devices } from '@playwright/test'

// E2E de FitZone Sports (ADR-007): el navegador maneja el frontend real, que habla con la API real, que usa un PostgreSQL
// real en Docker (base `fitzone_e2e`, preparada por scripts/preparar-base.mjs antes de cada corrida).
//
// Backend y frontend se levantan solos en puertos propios (3100 y 5180) para no chocar con los de desarrollo (3000 y
// 5173), y el backend apunta a la base E2E, nunca a la de Supabase.
export const URL_API = 'http://localhost:3100'
export const URL_WEB = 'http://localhost:5180'
const URL_BASE_E2E = 'postgresql://fitzone:fitzone@localhost:55432/fitzone_e2e?schema=public'

export default defineConfig({
  testDir: './tests',
  // Los recorridos comparten la base sembrada: uno por vez, en orden.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Solo en la terminal; las capturas y trazas de un fallo quedan en test-results/.
  reporter: [['list']],
  use: {
    baseURL: URL_WEB,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run start',
      cwd: '../backend',
      url: `${URL_API}/docs-json`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: URL_BASE_E2E,
        PORT: '3100',
        NODE_ENV: 'test',
        CORS_ORIGINS: URL_WEB,
      },
    },
    {
      command: 'npm run dev -- --port 5180 --strictPort',
      cwd: '../frontend',
      url: URL_WEB,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_URL: `${URL_API}/api/v1` },
      // Vite escribe en la terminal cada aviso de la consola del navegador: no aporta a la salida de las pruebas.
      stderr: 'ignore',
    },
  ],
})
