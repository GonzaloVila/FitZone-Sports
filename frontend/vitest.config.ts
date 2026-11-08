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
        reporter: ['text', 'html', 'json-summary'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,vue}'],
        // Fuera: los specs, los tipos generados del contrato y el arranque de la app.
        exclude: ['src/**/*.spec.ts', 'src/types/**', 'src/main.ts'],
        // Piso de cobertura (ADR-007): la línea base medida (53% líneas, 44% ramas, 42% funciones),
        // redondeada hacia abajo. Se sube a medida que se agregan los tests del frontend.
        thresholds: { lines: 50, statements: 50, branches: 40, functions: 40 },
      },
    },
  }),
)
