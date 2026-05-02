import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './pages/home.vue';
import ConfView from './pages/conf.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/find',
      name: 'find',
      // 路由级代码分割
      // 这会为该路由生成一个单独的 chunk (About.[hash].js)
      // 并在访问该路由时按需懒加载。
      component: () => import('./pages/find.vue'),
    },
    {
      path: '/editor',
      name: 'editor',
      component: () => import('./pages/editor.vue'),
    },
    {
      path: '/conf',
      name: 'conf',
      component: ConfView,
    },
  ],
});

export default router;
