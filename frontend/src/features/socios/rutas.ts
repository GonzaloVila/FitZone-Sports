import type { RouteRecordRaw } from 'vue-router'

export const rutasSocios: RouteRecordRaw[] = [
  {
    path: '/socios',
    name: 'socios',
    component: () => import('./pages/GestionSociosPage.vue'),
    meta: {
      roles: ['RECEPCION', 'GERENTE'],
      navegacion: { etiqueta: 'Socios', orden: 2, icono: 'socios', seccion: 'operaciones' },
    },
  },
  {
    path: '/socios/:socioId',
    name: 'socio-detalle',
    component: () => import('./pages/DetalleSocioPage.vue'),
    meta: { roles: ['RECEPCION', 'GERENTE'] },
  },
  {
    path: '/carnet',
    name: 'carnet',
    component: () => import('./pages/CarnetPage.vue'),
    meta: {
      roles: ['SOCIO'],
      navegacion: { etiqueta: 'Mi carnet', orden: 1, icono: 'carnet' },
    },
  },
]
