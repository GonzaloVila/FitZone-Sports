import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Tests de integración: bootean el módulo de feature (no el AppModule completo) contra
// la BD real de test y llaman al SERVICE directo (sin HTTP). El setup es el mismo que
// el de e2e: carga .env.test (fitzone_test).
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.integration-spec.ts'],
    setupFiles: ['./test/vitest.e2e.setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    reporters: ['verbose'],
    // Comparten una sola base (DATABASE_URL), igual que los e2e: no pueden correr en paralelo.
    fileParallelism: false,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  resolve: {
    alias: {
      src: resolve(import.meta.dirname, './src'),
      '@test': resolve(import.meta.dirname, './test'),
    },
  },
});
