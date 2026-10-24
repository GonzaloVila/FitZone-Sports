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
    // Estática: gana sobre /clases/:claseId, así que "nueva" nunca se interpreta como un id.
    path: '/clases/nueva',
    name: 'clases-nueva',
    component: () => import('./pages/AltaClasePage.vue'),
    meta: { roles: ['RECEPCION', 'GERENTE'] },
  },
  {
    path: '/clases/:claseId',
    name: 'clase-detalle',
    component: () => import('./pages/DetalleClasePage.vue'),
    meta: { roles: ['SOCIO', 'RECEPCION', 'GERENTE'] },
  },
  {
    path: '/mis-clases',
    name: 'mis-clases',
    component: () => import('./pages/MisClasesPage.vue'),
    meta: {
      roles: ['SOCIO'],
      navegacion: { etiqueta: 'Mis clases', orden: 5, icono: 'clases', seccion: 'actividades' },
    },
  },
]
