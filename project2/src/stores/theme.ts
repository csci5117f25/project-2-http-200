import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

type Theme = 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(() => {
    // Read saved theme from localStorage, use system preference if not available
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved) {
      return saved
    }
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme
  }

  // Watch theme changes and update DOM and localStorage
  watch(theme, (newTheme) => {
    if (typeof document !== 'undefined') {
      const html = document.documentElement
      if (newTheme === 'dark') {
        html.classList.add('dark')
      } else {
        html.classList.remove('dark')
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme', newTheme)
    }
  }, { immediate: true })

  return {
    theme,
    toggleTheme,
    setTheme
  }
})
