import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'login',
      component: () => import('../views/Login.vue')
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('../views/Home.vue')
    },
    {
      path: '/sop',
      name: 'sop',
      component: () => import('../views/SOP.vue')
    },
    {
      path: '/recommendation',
      name: 'recommendation',
      component: () => import('../views/Recommendation.vue')
    },
    {
      path: '/ai-search',
      name: 'ai-search',
      component: () => import('../views/AISearch.vue')
    }
  ]
})

export default router
