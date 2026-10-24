import type { RouteRecordRaw } from 'vue-router'

export const rutasPagos: RouteRecordRaw[] = [
  {
    path: '/pagos',
    name: 'pagos',
    component: () => import('./pages/PagosPage.vue'),
    meta: {
      roles: ['RECEPCION', 'GERENTE'],
      navegacion: { etiqueta: 'Pagos', orden: 8, icono: 'pagos', seccion: 'administracion' },
    },
  },
  {
    path: '/pagos/nuevo',
    name: 'pagar-reserva',
    component: () => import('./pages/PagarReservaPage.vue'),
    meta: { roles: ['SOCIO', 'RECEPCION', 'GERENTE', 'EXTERNO'] },
  },
  {
    path: '/reportes/ingresos',
    name: 'reporte-ingresos',
    component: () => import('./pages/ReporteIngresosPage.vue'),
    meta: {
      roles: ['GERENTE'],
      navegacion: { etiqueta: 'Reportes', orden: 9, icono: 'reportes', seccion: 'administracion' },
    },
  },
]
