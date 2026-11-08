import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    // Los unit specs viven junto al source. El glob NO matchea *.integration-spec.ts
    // (termina en "-spec.ts", no en ".spec.ts"), así que cada suite tiene su config.
    include: ['src/**/*.spec.ts'],
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage-unit',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.integration-spec.ts', 'src/**/*.module.ts', 'src/main.ts'],
      // Piso de cobertura (ADR-007): unos puntos por debajo de lo medido al cerrar los unitarios del
      // backend (71% líneas, 67% ramas, 64% funciones). Si un cambio la baja, test:unit:cov falla.
      thresholds: { lines: 70, statements: 70, branches: 65, functions: 60 },
    },
  },
  resolve: {
    alias: {
      src: resolve(import.meta.dirname, './src'),
      '@test': resolve(import.meta.dirname, './test'),
    },
  },
});