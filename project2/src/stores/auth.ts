import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuth = defineStore('auth', () => {
  const user = ref(null)
  
  const login = (userData: any) => {
    user.value = userData
  }
  
  const logout = () => {
    user.value = null
  }
  
  return { user, login, logout }
})
