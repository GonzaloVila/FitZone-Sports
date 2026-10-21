import { createRouter, createWebHistory } from 'vue-router'

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
    },
    {
      path: '/socios',
      name: 'socios',
      component: () => import('../features/socios/pages/GestionSociosPage.vue'),
    },
  ],
})

export default router
