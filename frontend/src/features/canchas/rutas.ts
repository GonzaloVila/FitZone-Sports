import type { RouteRecordRaw } from 'vue-router'

export const rutasCanchas: RouteRecordRaw[] = [
  {
    path: '/canchas',
    name: 'canchas',
    component: () => import('./pages/ListaCanchasPage.vue'),
    meta: {
      roles: ['SOCIO', 'RECEPCION', 'GERENTE', 'EXTERNO'],
      navegacion: { etiqueta: 'Canchas', orden: 6, icono: 'canchas', seccion: 'actividades' },
    },
  },
  {
    // La gestión (alta y edición) se integró a /canchas: el enlace viejo sigue funcionando.
    path: '/canchas/gestion',
    redirect: { name: 'canchas' },
  },
  {
    path: '/canchas/:canchaId/turnos',
    name: 'cancha-turnos',
    component: () => import('./pages/GrillaTurnosPage.vue'),
    meta: { roles: ['SOCIO', 'RECEPCION', 'GERENTE', 'EXTERNO'] },
  },
  {
    // "Mis reservas" es una vista de /canchas (solo para quien reserva): el enlace viejo sigue funcionando.
    path: '/mis-reservas',
    name: 'mis-reservas',
    redirect: { name: 'canchas', query: { vista: 'mis-reservas' } },
    meta: { roles: ['SOCIO', 'EXTERNO'] },
  },
]
