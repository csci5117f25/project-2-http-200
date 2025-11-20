import { createRouter, createWebHistory } from 'vue-router'

export default createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../views/Login.vue')
    },
    {
      path: '/home',
      component: () => import('../views/Home.vue')
    },
    {
      path: '/sop',
      component: () => import('../views/SOP.vue')
    },
    {
      path: '/recommendation',
      component: () => import('../views/Recommendation.vue')
    },
    {
      path: '/ai-search',
      component: () => import('../views/AISearch.vue')
    }
  ]
})
