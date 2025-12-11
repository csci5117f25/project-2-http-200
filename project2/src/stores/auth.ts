import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth'
import { auth } from '../firebase/config'

export const useAuth = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)
  
  // Initialize auth state listener
  onAuthStateChanged(auth, (currentUser) => {
    user.value = currentUser
    loading.value = false
  })
  
  const isAuthenticated = computed(() => !!user.value)
  
  const login = async () => {
    try {
      loading.value = true
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      console.error('Login failed:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  const logout = async () => {
    try {
      await firebaseSignOut(auth)
      // User state will be updated by onAuthStateChanged
    } catch (error) {
      console.error('Logout failed:', error)
      throw error
    }
  }
  
  return { 
    user, 
    loading, 
    isAuthenticated,
    login, 
    logout 
  }
})
