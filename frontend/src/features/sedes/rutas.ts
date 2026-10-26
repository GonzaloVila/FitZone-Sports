import type { RouteRecordRaw } from 'vue-router'

export const rutasSedes: RouteRecordRaw[] = [
  {
    path: '/sedes/nueva',
    name: 'sedes-nueva',
    component: () => import('./pages/AltaSedePage.vue'),
    meta: {
      roles: ['GERENTE'],
      activaEnNavegacion: 'acceso-aforo',
    },
  },
]
