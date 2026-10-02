import { defineConfig } from 'vitest/config';

// El comparador contra el backend: necesita el servidor arriba porque lee por
// HTTP el documento OpenAPI que publica el codigo. Vive en su propio proyecto
// para que `npm run test:contrato` (que no necesita nada levantado) siga en
// verde sin que haya que acordarse de arrancar nada.
//
// Para correrlo:
//   1. npm run build
//   2. node dist/main        (en otra terminal)
//   3. npm run test:contrato:diff
export default defineConfig({
  test: {
    globals: true,
    root: new URL('.', import.meta.url).pathname.replace(/\\|\/$/g, '/'),
    include: ['*.diff.spec.ts'],
    setupFiles: ['./setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});