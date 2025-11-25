<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const tools = [
  { label: 'Program', route: '/home', icon: '📋' },
  { label: 'AI Assisted Search', route: '/ai-search', icon: '🤖' },
  { label: 'Statement of Purpose', route: '/sop', icon: '📝' },
  { label: 'Recommendation Letters System', route: '/recommendation', icon: '📧' }
]
</script>

<template>
  <aside class="sidebar">
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
  width: 100%;
  background: white;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.tools {
  padding: 22px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 20px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
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
  flex: 1;
  max-width: 200px;
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
