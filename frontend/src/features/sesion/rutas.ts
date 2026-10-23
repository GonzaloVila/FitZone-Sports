import type { RouteRecordRaw } from 'vue-router'

// Pública y fuera del armazón: se arma con la plantilla centrada de la propia página.
export const rutasSesion: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('./pages/LoginPage.vue'),
    meta: { publica: true },
  },
]
