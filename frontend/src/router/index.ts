import { createRouter, createWebHistory } from 'vue-router'
import { rolPermitido, rutaInicialPorRol } from '../features/sesion/acceso'
import { useSesionStore } from '../features/sesion/stores/sesionStore'
import type { Rol } from '../features/sesion/tipos'

declare module 'vue-router' {
  interface RouteMeta {
    // Ruta accesible sin sesión.
    publica?: boolean
    // Roles que pueden entrar. Sin `roles`, la ruta solo requiere sesión.
    roles?: Rol[]
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../features/sesion/pages/LoginPage.vue'),
      meta: { publica: true },
    },
    {
      path: '/inicio',
      name: 'inicio',
      component: () => import('../features/inicio/pages/InicioPage.vue'),
    },
    {
      path: '/socios',
      name: 'socios',
      component: () => import('../features/socios/pages/GestionSociosPage.vue'),
      meta: { roles: ['RECEPCION', 'GERENTE'] },
    },
  ],
})

// Sin bucles: sin sesión solo se redirige a /login (pública); con sesión, /login y las rutas no permitidas
// llevan a la ruta inicial del rol, que por construcción (acceso.ts) es una ruta que ese rol sí puede ver.
router.beforeEach(async (to) => {
  const sesion = useSesionStore()
  await sesion.restaurar()

  if (!sesion.usuario) {
    if (to.meta.publica) return true
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  const rol = sesion.usuario.rol
  if (to.name === 'login' || !rolPermitido(to.meta.roles, rol)) return rutaInicialPorRol(rol)
  return true
})

export default router
