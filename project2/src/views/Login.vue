<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const router = useRouter()
const auth = useAuth()

const isLoggingIn = ref(false)
const error = ref<string | null>(null)

const login = async () => {
  try {
    isLoggingIn.value = true
    error.value = null
    await auth.login()
    // Redirect will happen automatically via router guard or onAuthStateChanged
    router.push('/home')
  } catch (err: any) {
    console.error('Login error:', err)
    error.value = err.message || 'Failed to sign in. Please try again.'
  } finally {
    isLoggingIn.value = false
  }
}
</script>

<template>
  <div class="container">
    <div class="box">
      <h1>PhD App Hub</h1>
      <p class="subtitle">Sign in to manage your PhD applications</p>
      
      <button 
        @click="login" 
        :disabled="isLoggingIn"
        class="google-sign-in-btn"
      >
        <span v-if="!isLoggingIn">Sign in with Google</span>
        <span v-else>Signing in...</span>
      </button>
      
      <p v-if="error" class="error-message">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.box {
  background: white;
  padding: 45px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  width: 90%;
}

h1 {
  font-size: 31px;
  margin-bottom: 12px;
  color: #333;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin-bottom: 28px;
}

.google-sign-in-btn {
  width: 100%;
  padding: 12px 24px;
  background: #4285f4;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.google-sign-in-btn:hover:not(:disabled) {
  background: #357ae8;
}

.google-sign-in-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-message {
  margin-top: 16px;
  color: #f44336;
  font-size: 14px;
}
</style>
