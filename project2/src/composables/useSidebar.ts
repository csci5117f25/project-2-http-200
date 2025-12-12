import { computed } from 'vue'
import { useSidebarStore } from '../stores/sidebar'

export function useSidebar() {
  const sidebarStore = useSidebarStore()

  const contentMargin = computed(() => {
    return sidebarStore.isCollapsed ? 'ml-32' : 'ml-72'
  })

  return {
    contentMargin,
    isCollapsed: computed(() => sidebarStore.isCollapsed),
    toggle: sidebarStore.toggle,
    collapse: sidebarStore.collapse,
    expand: sidebarStore.expand
  }
}

