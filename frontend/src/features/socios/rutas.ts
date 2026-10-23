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
  {
    // Estática: gana sobre /socios/:socioId, así que "nuevo" nunca se interpreta como un id.
    path: '/socios/nuevo',
    name: 'socios-nuevo',
    component: () => import('./pages/NuevoSocioPage.vue'),
    meta: { roles: ['RECEPCION', 'GERENTE'] },
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
      navegacion: { etiqueta: 'Mi carnet', orden: 1 },
    },
  },
]
