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
