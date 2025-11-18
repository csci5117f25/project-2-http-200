<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const navItems = [
  { label: 'Recommendation Letters', route: '/recommendation' },
  { label: 'AI Assisted Search', route: '/ai-search' },
  { label: 'Statement of Purpose', route: '/sop' }
]
</script>

<template>
  <aside class="sidebar">
    <div class="header">
      <div class="logo" @click="router.push('/home')">
        <span>PhD App Hub</span>
      </div>
    </div>
    
    <nav>
      <div 
        v-for="item in navItems" 
        :key="item.route"
        class="nav-item"
        @click="router.push(item.route)"
      >
        {{ item.label }}
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 280px;
  background: white;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.header {
  padding: 24px;
  border-bottom: 1px solid var(--border);
}

.logo {
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
}

nav {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nav-item {
  padding: 16px;
  background: var(--light-bg);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.nav-item:hover {
  background: var(--coral);
  color: white;
}
</style>
