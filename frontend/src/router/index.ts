import { createRouter, createWebHistory } from 'vue-router'
import { rutasAcceso } from '../features/acceso/rutas'
import { rutasCanchas } from '../features/canchas/rutas'
import { rutasClases } from '../features/clases/rutas'
import { rutasInicio } from '../features/inicio/rutas'
import { rutasPagos } from '../features/pagos/rutas'
import { NOMBRE_RUTA_NO_ENCONTRADA, rolPermitido, rutaInicialPorRol } from '../features/sesion/acceso'
import { rutasSedes } from '../features/sedes/rutas'
import { rutasSesion } from '../features/sesion/rutas'
import { useSesionStore } from '../features/sesion/stores/sesionStore'
import type { Rol } from '../features/sesion/tipos'
import { rutasSocios } from '../features/socios/rutas'
import type { NombreIconoFz } from '../ui'

declare module 'vue-router' {
  interface RouteMeta {
    // Ruta accesible sin sesión.
    publica?: boolean
    // Roles que pueden entrar. Sin `roles`, la ruta solo requiere sesión.
    roles?: Rol[]
    // Si está, la ruta aparece como link en la navegación del armazón (solo a los roles que puedan entrar).
    // `icono` y `seccion` son opcionales: la barra lateral agrupa por sección (sin sección va arriba, sin título).
    navegacion?: {
      etiqueta: string
      orden: number
      icono?: NombreIconoFz
      seccion?: 'operaciones' | 'actividades' | 'administracion'
    }
  }
}

// Cada feature define sus rutas en features/<x>/rutas.ts; acá solo se juntan.
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...rutasSesion,
    {
      // Armazón de las rutas autenticadas. Si se entra a '/' exacto, va a /login y el guard lo reubica.
      path: '/',
      component: () => import('../app/ArmazonApp.vue'),
      redirect: '/login',
      children: [
        ...rutasInicio,
        ...rutasSocios,
        ...rutasAcceso,
        ...rutasSedes,
        ...rutasClases,
        ...rutasCanchas,
        ...rutasPagos,
      ],
    },
    // Comodín: toda ruta inexistente va a /login; el guard reubica a quien tenga sesión.
    {
      path: '/:pathMatch(.*)*',
      name: NOMBRE_RUTA_NO_ENCONTRADA,
      redirect: { name: 'login' },
    },
  ],
})

// Sin bucles: sin sesión solo se redirige a /login (pública); con sesión, /login y las rutas no permitidas
// llevan a la ruta inicial del rol, que por construcción (acceso.ts) es una ruta que ese rol sí puede ver.
// El comodín redirige a /login, así que cae en uno de esos dos casos.
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
