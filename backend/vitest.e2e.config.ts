import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/vitest.e2e.setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Verboso a propósito: cada corrida imprime EN VIVO el nombre de cada test con
    // su resultado y duración, para ver qué flujo (principal/alternativo) se está
    // cubriendo mientras corre.
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage-e2e',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.module.ts', 'src/main.ts'],
    },
    // Las tres suites comparten UNA sola base (la de DATABASE_URL), asi que no pueden
    // correr en paralelo: se pisan los datos de fixtures y los afterAll de una borran lo
    // que la otra todavia esta usando. Con fileParallelism en true, la suite de M3
    // inflaba el resultado de GET /socios?plan= de M1 mas alla del per_page por defecto
    // y el test de lista blanca fallaba por paginacion, no por logica.
    fileParallelism: false,
  },
  plugins: [
    // Necesario para compilar los tests con SWC y que la metadata de
    // decoradores (DI de Nest) se emita correctamente.
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  resolve: {
    alias: {
      src: resolve(import.meta.dirname, './src'),
    },
  },
});
