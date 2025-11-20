<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const router = useRouter()
const auth = useAuth()

const login = () => {
  auth.login({ email: 'user@example.com' })
  router.push('/home')
}
</script>

<template>
  <div class="container">
    <div class="box">
      <h1>PhD App Hub</h1>
      <button @click="login">Sign in with Google</button>
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
}

h1 {
  font-size: 31px;
  margin-bottom: 28px;
}

button {
  padding: 11px 30px;
  background: var(--coral);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}
</style>

