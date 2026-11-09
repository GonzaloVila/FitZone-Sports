import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    // PWA (RNF-01): el puesto de control tiene que poder abrir la app sin conexión. El service worker solo se genera en
    // el build (`npm run build` + `npm run preview`); en `npm run dev` no se registra.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logofzsvg.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'FitZone Sports',
        short_name: 'FitZone',
        description: 'Gestión de socios, accesos, clases y canchas de FitZone Sports.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1a6ec1',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // El shell (HTML, JS, CSS e íconos del build) queda precacheado al instalar el service worker: es lo que permite
        // abrir la app en frío sin red. Cualquier navegación sin red cae en index.html y la resuelve el router.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/docs/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // La API nunca se cachea: son datos con sesión y tienen que estar al día. Sin red, la app usa su propia cola
            // offline y la lista local de inhabilitados.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            // Lo que no entra en el precache (fuentes de Google e imágenes): se sirve lo guardado y se actualiza de fondo.
            urlPattern: ({ url, request }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com' ||
              request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fitzone-recursos',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
