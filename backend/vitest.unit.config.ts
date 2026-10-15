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
  },
  resolve: {
    alias: {
      src: resolve(import.meta.dirname, './src'),
      '@test': resolve(import.meta.dirname, './test'),
    },
  },
});