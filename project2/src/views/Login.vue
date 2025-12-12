<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import Card from '@/components/ui/card.vue'
import CardHeader from '@/components/ui/card-header.vue'
import CardTitle from '@/components/ui/card-title.vue'
import CardDescription from '@/components/ui/card-description.vue'
import CardContent from '@/components/ui/card-content.vue'
import Button from '@/components/ui/button.vue'

const router = useRouter()
const auth = useAuth()

const isLoggingIn = ref(false)
const error = ref<string | null>(null)

const login = async () => {
  try {
    isLoggingIn.value = true
    error.value = null
    await auth.login()
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
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
    <Card class="w-full max-w-md">
      <CardHeader class="text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 mb-4 mx-auto">
          <span class="text-white font-bold text-2xl">PhD</span>
        </div>
        <CardTitle class="text-3xl">PhD App Hub</CardTitle>
        <CardDescription class="text-base">
          Sign in to manage your PhD applications
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <Button
          @click="login"
          :disabled="isLoggingIn"
          class="w-full h-11 text-base"
          size="lg"
        >
          <svg v-if="!isLoggingIn" class="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span v-if="!isLoggingIn">Sign in with Google</span>
          <span v-else>Signing in...</span>
        </Button>

        <div v-if="error" class="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p class="text-sm text-destructive text-center">{{ error }}</p>
        </div>

        <p class="text-xs text-center text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </CardContent>
    </Card>
  </div>
</template>
