import type { RouteRecordRaw } from 'vue-router'

export const rutasAcceso: RouteRecordRaw[] = [
  {
    path: '/acceso/aforo',
    name: 'acceso-aforo',
    component: () => import('./pages/AforoPage.vue'),
    meta: {
      roles: ['RECEPCION', 'GERENTE'],
      navegacion: { etiqueta: 'Acceso', orden: 3, icono: 'acceso', seccion: 'operaciones' },
    },
  },
  {
    path: '/acceso/ingreso',
    name: 'acceso-ingreso',
    component: () => import('./pages/RegistrarIngresoPage.vue'),
    meta: {
      roles: ['RECEPCION', 'GERENTE'],
      activaEnNavegacion: 'acceso-aforo',
    },
  },
  {
    path: '/acceso/historial',
    name: 'acceso-historial',
    component: () => import('./pages/HistorialAccesosPage.vue'),
    meta: {
      roles: ['RECEPCION', 'GERENTE'],
      activaEnNavegacion: 'acceso-aforo',
    },
  },
]
