<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const router = useRouter()
const auth = useAuth()

const handleLogin = () => {
  // TODO: Firebase auth
  auth.login({ email: 'user@example.com' })
  router.push('/home')
}
</script>

<template>
  <div class="container">
    <div class="box">
      <h1>PhD App Hub</h1>
      <button @click="handleLogin">Sign in with Google</button>
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
  padding: 48px;
  border-radius: 12px;
  text-align: center;
}

h1 {
  font-size: 32px;
  margin-bottom: 32px;
}

button {
  padding: 12px 32px;
  background: var(--coral);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}
</style>

