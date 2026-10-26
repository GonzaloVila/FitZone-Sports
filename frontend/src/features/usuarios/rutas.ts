import type { RouteRecordRaw } from 'vue-router'

export const rutasStaff: RouteRecordRaw[] = [
  {
    path: '/staff',
    name: 'staff',
    component: () => import('./pages/GestionStaffPage.vue'),
    meta: {
      roles: ['GERENTE'],
      navegacion: { etiqueta: 'Staff', orden: 10, icono: 'equipo', seccion: 'administracion' },
    },
  },
]
