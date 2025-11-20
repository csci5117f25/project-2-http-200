<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const router = useRouter()
const auth = useAuth()

const tools = [
  { label: 'Recommendation Letters System', route: '/recommendation', icon: '📧' },
  { label: 'AI Assisted Search', route: '/ai-search', icon: '🤖' },
  { label: 'Statement of Purpose', route: '/sop', icon: '📝' }
]

const getInitial = () => {
  return auth.user?.email?.[0]?.toUpperCase() || 'U'
}
</script>

<template>
  <aside class="sidebar">
    <div class="top">
      <div class="brand" @click="router.push('/home')">
        <div class="logo">PhD</div>
        <span class="title">App Hub</span>
      </div>
      <div class="avatar">
        <div class="circle">{{ getInitial() }}</div>
      </div>
    </div>
    
    <nav class="tools">
      <div 
        v-for="tool in tools" 
        :key="tool.route"
        class="tool-card"
        @click="router.push(tool.route)"
      >
        <div class="icon">{{ tool.icon }}</div>
        <div class="label">{{ tool.label }}</div>
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 300px;
  background: white;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.top {
  padding: 26px 22px;
  border-bottom: 1px solid var(--border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 13px;
  cursor: pointer;
  margin-bottom: 18px;
}

.logo {
  width: 52px;
  height: 52px;
  background: linear-gradient(135deg, var(--coral), #ff8e6e);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.5px;
}

.title {
  font-size: 22px;
  font-weight: 700;
  color: var(--dark);
}

.avatar {
  display: flex;
}

.circle {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--coral);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 17px;
}

.tools {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.tool-card {
  padding: 19px 17px;
  background: var(--light-bg);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.23s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 9px;
}

.tool-card:hover {
  background: var(--coral);
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(255, 107, 107, 0.2);
}

.tool-card:hover .icon {
  transform: scale(1.1);
}

.tool-card:hover .label {
  color: white;
}

.icon {
  font-size: 34px;
  transition: transform 0.25s;
}

.label {
  font-size: 13px;
  font-weight: 500;
  color: var(--dark);
  transition: color 0.25s;
  line-height: 1.4;
}
</style>
