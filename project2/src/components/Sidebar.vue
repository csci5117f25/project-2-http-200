<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../stores/auth'
import { useSidebarStore } from '../stores/sidebar'
import { useThemeStore } from '../stores/theme'
import { cn } from '@/lib/utils'
import Button from './ui/button.vue'
import Tooltip from './ui/tooltip.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuth()
const sidebarStore = useSidebarStore()
const themeStore = useThemeStore()

const tools = [
  { label: 'Dashboard', route: '/home', icon: '📊' },
  { label: 'Intelligent Search', route: '/ai-search', icon: '🔍' },
  { label: 'SOP', route: '/sop', icon: '📝' },
  { label: 'Recommendations', route: '/recommendation', icon: '📧' }
]

const isActive = (toolRoute: string) => {
  return route.path === toolRoute || route.path.startsWith(toolRoute + '/')
}

const getInitial = () => {
  return auth.user?.email?.[0]?.toUpperCase() || 'U'
}

const getUserName = () => {
  return auth.user?.email?.split('@')[0] || 'User'
}

const handleNavigation = async (routePath: string) => {
  try {
    // Check if already on the target route
    if (route.path === routePath) {
      return
    }
    
    await router.push(routePath)
  } catch (err: any) {
    // Ignore navigation errors if already on the route
    if (err.name === 'NavigationDuplicated') {
      return
    }
    
    // For module loading errors (Vite dev server issue), try to reload the page
    if (err.message && err.message.includes('Failed to fetch dynamically imported module')) {
      console.warn('Module loading error detected, reloading page...')
      // Use window.location to force a full page reload
      window.location.href = routePath
      return
    }
    
    // Log other errors for debugging
    console.error('Navigation error:', err)
  }
}

const handleLogout = async () => {
  try {
    await auth.logout()
    router.push('/')
  } catch (error) {
    console.error('Logout failed:', error)
    alert('Logout failed. Please try again.')
  }
}

// Responsive sidebar width with minimum constraints
const sidebarWidth = computed(() => {
  if (sidebarStore.isCollapsed) {
    return 'w-16 md:w-24 lg:w-32' // Responsive collapsed: mobile 16, tablet 24, desktop 32
  }
  return 'w-64 md:w-72 lg:w-80' // Responsive expanded: mobile 64, tablet 72, desktop 80
})
</script>

<template>
  <aside 
    :class="cn(
      'h-screen bg-card border-r border-border flex flex-col z-50 transition-all duration-300 ease-in-out flex-shrink-0',
      sidebarWidth
    )"
  >
    <!-- Toggle button - fixed at top-right corner of sidebar -->
    <Tooltip :content="sidebarStore.isCollapsed ? 'Expand' : 'Collapse'" side="right">
      <Button
        variant="ghost"
        size="icon"
        class="absolute top-5 right-2 h-8 w-8 text-gray-400 hover:text-white hover:bg-white/5 flex-shrink-0 z-[60]"
        @click.stop="sidebarStore.toggle()"
      >
        <span class="text-lg">{{ sidebarStore.isCollapsed ? '→' : '←' }}</span>
      </Button>
    </Tooltip>

    <!-- Logo/Brand at top - separate layout flow -->
    <div :class="cn(
      'py-4 border-b border-border relative',
      sidebarStore.isCollapsed ? 'px-2' : 'px-3 pr-12'
    )">
      <div 
        :class="cn(
          'flex items-center cursor-pointer',
          sidebarStore.isCollapsed ? 'justify-center' : 'justify-center gap-3'
        )"
        @click="router.push('/home')"
      >
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          PhD
        </div>
        <Transition
          enter-active-class="transition-all duration-300 ease-in-out"
          enter-from-class="opacity-0 max-w-0"
          enter-to-class="opacity-100 max-w-[120px]"
          leave-active-class="transition-all duration-300 ease-in-out"
          leave-from-class="opacity-100 max-w-[120px]"
          leave-to-class="opacity-0 max-w-0"
        >
          <span v-if="!sidebarStore.isCollapsed" class="text-foreground font-semibold text-lg whitespace-nowrap overflow-hidden block">
            App Hub
          </span>
        </Transition>
      </div>
    </div>

    <!-- Navigation items - separate layout flow, independent of toggle button -->
    <nav class="flex-1 flex flex-col px-2 py-4 gap-1 overflow-y-auto overflow-x-visible mt-0">
      <Tooltip 
        v-for="tool in tools"
        :key="tool.route"
        :content="sidebarStore.isCollapsed ? tool.label : ''"
        side="right"
        :delay-duration="sidebarStore.isCollapsed ? 300 : 0"
      >
        <Button
          :variant="isActive(tool.route) ? 'default' : 'ghost'"
          :class="cn(
            'h-10 transition-all duration-200 flex items-center relative cursor-pointer w-full',
            sidebarStore.isCollapsed 
              ? 'justify-center px-2' 
              : 'justify-center gap-3 px-3',
            isActive(tool.route)
              ? 'bg-accent text-accent-foreground hover:bg-accent/80'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )"
          type="button"
          @click.stop="handleNavigation(tool.route)"
        >
          <span class="text-lg flex-shrink-0">{{ tool.icon }}</span>
          <Transition
            enter-active-class="transition-all duration-300 ease-in-out"
            enter-from-class="opacity-0 max-w-0"
            enter-to-class="opacity-100 max-w-xs"
            leave-active-class="transition-all duration-300 ease-in-out"
            leave-from-class="opacity-100 max-w-xs"
            leave-to-class="opacity-0 max-w-0"
          >
            <span v-if="!sidebarStore.isCollapsed" class="text-sm font-medium whitespace-nowrap overflow-hidden">
              {{ tool.label }}
            </span>
          </Transition>
        </Button>
      </Tooltip>
    </nav>

    <!-- User section at bottom - separate layout flow -->
    <div class="p-4 border-t border-border space-y-3">
      <!-- User info -->
      <Tooltip 
        :content="sidebarStore.isCollapsed ? getUserName() : ''"
        side="right"
        :delay-duration="sidebarStore.isCollapsed ? 300 : 0"
      >
        <div :class="cn(
          'flex items-center',
          sidebarStore.isCollapsed ? 'justify-center gap-0' : 'justify-center gap-3 flex-col'
        )">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {{ getInitial() }}
          </div>
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 max-h-0 scale-95"
            enter-to-class="opacity-100 max-h-20 scale-100"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 max-h-20 scale-100"
            leave-to-class="opacity-0 max-h-0 scale-95"
          >
            <div v-if="!sidebarStore.isCollapsed" class="text-center overflow-hidden">
              <p class="text-sm font-medium text-foreground">{{ getUserName() }}</p>
            </div>
          </Transition>
        </div>
      </Tooltip>

      <!-- Theme toggle button -->
      <Tooltip 
        :content="sidebarStore.isCollapsed ? (themeStore.theme === 'dark' ? 'Dark Mode' : 'Light Mode') : ''"
        side="right"
        :delay-duration="sidebarStore.isCollapsed ? 300 : 0"
      >
        <Button
          @click="themeStore.toggleTheme()"
          variant="ghost"
          :class="cn(
            'h-10 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 flex items-center',
            sidebarStore.isCollapsed 
              ? 'w-full justify-center px-2' 
              : 'w-[calc(100%-0.5rem)] justify-center gap-3 px-3 mr-2'
          )"
        >
          <span class="text-lg flex-shrink-0">{{ themeStore.theme === 'dark' ? '🌙' : '☀️' }}</span>
          <Transition
            enter-active-class="transition-all duration-300 ease-in-out"
            enter-from-class="opacity-0 max-w-0"
            enter-to-class="opacity-100 max-w-xs"
            leave-active-class="transition-all duration-300 ease-in-out"
            leave-from-class="opacity-100 max-w-xs"
            leave-to-class="opacity-0 max-w-0"
          >
            <span v-if="!sidebarStore.isCollapsed" class="text-sm font-medium whitespace-nowrap overflow-hidden">
              {{ themeStore.theme === 'dark' ? 'Dark Mode' : 'Light Mode' }}
            </span>
          </Transition>
        </Button>
      </Tooltip>

      <!-- Logout button -->
      <Tooltip 
        :content="sidebarStore.isCollapsed ? 'Logout' : ''"
        side="right"
        :delay-duration="sidebarStore.isCollapsed ? 300 : 0"
      >
        <Button
          @click="handleLogout"
          variant="ghost"
          :class="cn(
            'h-10 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 flex items-center',
            sidebarStore.isCollapsed 
              ? 'w-full justify-center px-2' 
              : 'w-[calc(100%-0.5rem)] justify-center gap-3 px-3 mr-2'
          )"
        >
          <span class="text-lg flex-shrink-0">🚪</span>
          <Transition
            enter-active-class="transition-all duration-300 ease-in-out"
            enter-from-class="opacity-0 max-w-0"
            enter-to-class="opacity-100 max-w-xs"
            leave-active-class="transition-all duration-300 ease-in-out"
            leave-from-class="opacity-100 max-w-xs"
            leave-to-class="opacity-0 max-w-0"
          >
            <span v-if="!sidebarStore.isCollapsed" class="text-sm font-medium whitespace-nowrap overflow-hidden">
              Logout
            </span>
          </Transition>
        </Button>
      </Tooltip>
    </div>
  </aside>
</template>
