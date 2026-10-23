import type { RouteRecordRaw } from 'vue-router'

export const rutasInicio: RouteRecordRaw[] = [
  {
    path: '/inicio',
    name: 'inicio',
    component: () => import('./pages/InicioPage.vue'),
    meta: { navegacion: { etiqueta: 'Inicio', orden: 1 } },
  },
]
