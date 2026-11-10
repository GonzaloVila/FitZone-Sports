import { fileURLToPath } from 'node:url'

import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

// Reutiliza los plugins y el alias de Vite; los specs viven al lado del código.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      root: fileURLToPath(new URL('./', import.meta.url)),
      include: ['src/**/*.spec.ts'],
      exclude: [...configDefaults.exclude],
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        // Solo la tabla en la terminal: no genera carpetas ni HTML.
        reporter: ['text'],
        include: ['src/**/*.{ts,vue}'],
        // Fuera: los specs, los tipos generados del contrato y el arranque de la app.
        exclude: ['src/**/*.spec.ts', 'src/types/**', 'src/main.ts'],
        // Piso de cobertura (ADR-007): lo medido con todas las áreas cubiertas (85% líneas, 74% ramas, 75% funciones),
        // redondeado hacia abajo para dejar margen a cambios chicos sin tests.
        thresholds: { lines: 82, statements: 80, branches: 72, functions: 72 },
      },
    },
  }),
)
