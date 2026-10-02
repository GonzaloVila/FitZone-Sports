import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Proyecto de vitest propio del comparador, separado del e2e a proposito:
//
// - No necesita la base de datos. El documento OpenAPI se lee por HTTP del
//   servidor ya levantado, asi que este proyecto no levanta Prisma ni docker.
// - No usa fileParallelism:false porque no comparte fixtures con nadie. Los
//   specs son puros y corren en paralelo sin pisarse.
//
// `*.diff.spec.ts` queda fuera de este proyecto a proposito: son los unicos que
// necesitan el backend arriba, porque comparan el YAML contra el documento que
// publica el codigo. Se corren aparte con `npm run test:contrato:diff`. Lo que
// queda aca corre siempre y sin servidor, que es donde viven las 11 entradas de
// PERMITIDAS, el resolver y el chequeo de que el vault no quedo viejo.
export default defineConfig({
  test: {
    globals: true,
    root: resolve(import.meta.dirname, '.'),
    include: ['*.spec.ts'],
    exclude: ['*.diff.spec.ts'],
    setupFiles: ['./setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  plugins: [
    swc.vite({ module: { type: 'es6' } }),
  ],
});
