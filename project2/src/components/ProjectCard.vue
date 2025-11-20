<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  data: any
}>()

const emit = defineEmits(['edit'])

const expanded = ref(false)
</script>

<template>
  <div class="card" :class="{ expanded }">
    <div class="header" @click="expanded = !expanded">
      <div class="left">
        <div class="logo">{{ data.school?.substring(0, 2) || 'UN' }}</div>
        <div class="info">
          <h3>{{ data.school }}</h3>
          <div class="meta">
            <span class="program">{{ data.program }}</span>
            <span class="prof">Prof. {{ data.professor }}</span>
          </div>
        </div>
      </div>
      <div class="actions">
        <button class="edit-btn" @click.stop="emit('edit', data)">✎</button>
        <button class="toggle">{{ expanded ? '−' : '+' }}</button>
      </div>
    </div>
    
    <div v-if="expanded" class="body">
      <div class="section">
        <h4>Professor Information</h4>
        <p v-if="data.homepage">
          <a :href="data.homepage" target="_blank">{{ data.homepage }}</a>
        </p>
        <p v-if="data.scholarid && data.scholarid !== 'NOSCHOLARPAGE'" class="scholar">
          Scholar ID: {{ data.scholarid }}
        </p>
      </div>
      
      <div class="section">
        <h4>To-Do List</h4>
        <div class="todos" v-if="data.todos?.length">
          <div class="todo-header">
            <div>Time</div>
            <div>Task</div>
            <div>State</div>
            <div>Frequency</div>
          </div>
          <div 
            v-for="(todo, i) in data.todos" 
            :key="i"
            class="todo-row"
          >
            <div>{{ todo.time }}</div>
            <div>{{ todo.task }}</div>
            <div><span class="badge">{{ todo.state }}</span></div>
            <div>{{ todo.frequency }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.2s;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  cursor: pointer;
}

.left {
  display: flex;
  gap: 16px;
  align-items: center;
  flex: 1;
}

.logo {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  flex-shrink: 0;
}

.info h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--dark);
}

.meta {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.program {
  padding: 3px 10px;
  background: var(--coral);
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.prof {
  font-size: 14px;
  color: var(--gray);
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.edit-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--light-bg);
  color: var(--dark);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-btn:hover {
  background: var(--coral);
  color: white;
}

.toggle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--light-bg);
  color: var(--coral);
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.toggle:hover {
  background: var(--coral);
  color: white;
}

.body {
  padding: 0 24px 24px;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.section {
  margin-bottom: 16px;
}

.section h4 {
  font-size: 15px;
  margin-bottom: 10px;
  color: var(--dark);
}

.section p {
  font-size: 14px;
  color: var(--gray);
  line-height: 1.6;
}

.section a {
  color: var(--coral);
  text-decoration: none;
}

.section a:hover {
  text-decoration: underline;
}

.scholar {
  font-size: 12px;
  color: var(--gray);
  margin-top: 4px;
}

.todos {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.todo-header {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr 1fr;
  gap: 12px;
  padding: 12px 16px;
  background: var(--light-bg);
  font-size: 13px;
  font-weight: 600;
  color: var(--dark);
}

.todo-row {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr 1fr;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  font-size: 13px;
  color: var(--dark);
}

.badge {
  padding: 4px 8px;
  background: var(--light-bg);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--gray);
}
</style>
