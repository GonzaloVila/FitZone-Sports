import type { RouteRecordRaw } from 'vue-router'

export const rutasSocios: RouteRecordRaw[] = [
  {
    path: '/socios',
    name: 'socios',
    component: () => import('./pages/GestionSociosPage.vue'),
    meta: {
      roles: ['RECEPCION', 'GERENTE'],
      navegacion: { etiqueta: 'Socios', orden: 2 },
    },
  },
]
