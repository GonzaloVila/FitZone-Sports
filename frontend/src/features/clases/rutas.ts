import type { RouteRecordRaw } from 'vue-router'

export const rutasClases: RouteRecordRaw[] = [
  {
    path: '/clases',
    name: 'clases',
    component: () => import('./pages/AgendaClasesPage.vue'),
    meta: {
      roles: ['SOCIO', 'RECEPCION', 'GERENTE'],
      navegacion: { etiqueta: 'Clases', orden: 4, icono: 'clases', seccion: 'actividades' },
    },
  },
  {
    path: '/clases/:claseId',
    name: 'clase-detalle',
    component: () => import('./pages/DetalleClasePage.vue'),
    meta: { roles: ['SOCIO', 'RECEPCION', 'GERENTE'] },
  },
  {
    // "Mis clases" es una vista de /clases: el enlace viejo sigue funcionando.
    path: '/mis-clases',
    redirect: { name: 'clases', query: { vista: 'mis-clases' } },
  },
]
