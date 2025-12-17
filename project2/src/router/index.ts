import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../views/Login.vue'),
      meta: { requiresGuest: true }
    },
    {
      path: '/home',
      component: () => import('../views/Home.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/sop',
      component: () => import('../views/SOP.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/recommendation',
      component: () => import('../views/Recommendation.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/ai-search',
      component: () => import('../views/AISearch.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/stipend-rankings',
      component: () => import('../views/StipendRankings.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/professor/invite/:tokenId',
      component: () => import('../views/ProfessorInvite.vue'),
      meta: { public: true }
    }
  ]
})

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const auth = useAuth()
  
  // Wait for auth to initialize
  if (auth.loading) {
    await new Promise<void>((resolve) => {
      const checkLoading = setInterval(() => {
        if (!auth.loading) {
          clearInterval(checkLoading)
          resolve()
        }
      }, 50)
    })
  }
  
  // Public routes (like professor invite page)
  if (to.meta.public) {
    next()
    return
  }
  
  // Guest-only routes (login page)
  if (to.meta.requiresGuest) {
    if (auth.isAuthenticated) {
      next('/home')
    } else {
      next()
    }
    return
  }
  
  // Protected routes
  if (to.meta.requiresAuth) {
    if (auth.isAuthenticated) {
      next()
    } else {
      next('/')
    }
    return
  }
  
  next()
})

export default router
