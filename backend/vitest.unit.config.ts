import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/unit/**/*.spec.ts'],
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      src: resolve(import.meta.dirname, './src'),
    },
  },
});