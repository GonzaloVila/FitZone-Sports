import type { RouteRecordRaw } from 'vue-router'

export const rutasPersonal: RouteRecordRaw[] = [
  {
    path: '/personal',
    name: 'personal',
    component: () => import('./pages/GestionPersonalPage.vue'),
    meta: {
      roles: ['GERENTE'],
      navegacion: { etiqueta: 'Personal', orden: 10, icono: 'equipo', seccion: 'administracion' },
    },
  },
]
