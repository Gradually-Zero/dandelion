import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/Home.vue'
import ConfView from '../views/Conf.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/find',
      name: 'find',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/Find.vue')
    },
    {
      path: '/conf',
      name: 'conf',
      component: ConfView
    }
  ]
})

export default router
