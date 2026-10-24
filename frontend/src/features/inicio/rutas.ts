import type { RouteRecordRaw } from 'vue-router'

// Sin `navegacion`: no aparece en el menú. Es la ruta de respaldo de los roles desconocidos (rutaInicialPorRol).
export const rutasInicio: RouteRecordRaw[] = [
  {
    path: '/inicio',
    name: 'inicio',
    component: () => import('./pages/InicioPage.vue'),
  },
]
