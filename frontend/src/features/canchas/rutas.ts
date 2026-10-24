import type { RouteRecordRaw } from 'vue-router'

export const rutasCanchas: RouteRecordRaw[] = [
  {
    path: '/canchas',
    name: 'canchas',
    component: () => import('./pages/ListaCanchasPage.vue'),
    meta: {
      roles: ['SOCIO', 'RECEPCION', 'GERENTE', 'EXTERNO'],
      navegacion: { etiqueta: 'Canchas', orden: 6 },
    },
  },
  {
    // Estática: gana sobre /canchas/:canchaId, así que "gestion" nunca se interpreta como un id.
    path: '/canchas/gestion',
    name: 'canchas-gestion',
    component: () => import('./pages/GestionCanchasPage.vue'),
    meta: { roles: ['GERENTE'] },
  },
  {
    path: '/canchas/:canchaId/turnos',
    name: 'cancha-turnos',
    component: () => import('./pages/GrillaTurnosPage.vue'),
    meta: { roles: ['SOCIO', 'RECEPCION', 'GERENTE', 'EXTERNO'] },
  },
  {
    path: '/mis-reservas',
    name: 'mis-reservas',
    component: () => import('./pages/MisReservasPage.vue'),
    meta: {
      roles: ['SOCIO', 'RECEPCION', 'GERENTE', 'EXTERNO'],
      navegacion: { etiqueta: 'Mis reservas', orden: 7 },
    },
  },
]
