<script setup lang="ts">
import { ref } from 'vue'
import { useProjects } from '../stores/projects'

const props = defineProps<{
  data: any
}>()

const emit = defineEmits(['edit'])

const projects = useProjects()
const expanded = ref(false)
const editingTodo = ref<number | null>(null)
const newTodo = ref({ time: '', task: '', state: 'Pending', frequency: 'Medium' })

const formatDateInput = (value: string) => {
  const cleaned = value.replace(/\D/g, '')
  if (cleaned.length <= 2) {
    return cleaned
  } else if (cleaned.length <= 4) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`
  } else {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`
  }
}

const handleDateInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  newTodo.value.time = formatDateInput(target.value)
}

const updateTodoState = (index: number, newState: string) => {
  if (!props.data.todos) return
  const updatedTodos = [...props.data.todos]
  updatedTodos[index] = { ...updatedTodos[index], state: newState }
  projects.update(props.data.id, { ...props.data, todos: updatedTodos })
  localStorage.setItem('projects', JSON.stringify(projects.projects))
}

const addNewTodo = () => {
  if (!newTodo.value.task.trim()) return
  const updatedTodos = [...(props.data.todos || [])]
  updatedTodos.push({ ...newTodo.value })
  projects.update(props.data.id, { ...props.data, todos: updatedTodos })
  localStorage.setItem('projects', JSON.stringify(projects.projects))
  newTodo.value = { time: '', task: '', state: 'Pending', frequency: 'Medium' }
}
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
            <div>
              <select 
                :value="todo.state" 
                @change="updateTodoState(i, ($event.target as HTMLSelectElement).value)"
                class="state-select"
              >
                <option>Pending</option>
                <option>Processing</option>
                <option>Finished</option>
              </select>
            </div>
            <div>{{ todo.frequency }}</div>
          </div>
        </div>
        <div class="add-todo">
          <input 
            :value="newTodo.time"
            @input="handleDateInput"
            type="text" 
            class="todo-input todo-time"
            placeholder="MM/DD/YYYY"
            maxlength="10"
          />
          <input 
            v-model="newTodo.task" 
            class="todo-input"
            placeholder="Task"
          />
          <select v-model="newTodo.state" class="todo-select">
            <option>Pending</option>
            <option>Processing</option>
            <option>Finished</option>
          </select>
          <select v-model="newTodo.frequency" class="todo-select">
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
          <button class="add-todo-btn" @click="addNewTodo">+</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: white;
  border-radius: 12px;
  overflow: visible;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.2s;
  width: 100%;
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
  overflow-x: auto;
}

.todo-header {
  display: grid;
  grid-template-columns: 120px minmax(200px, 1fr) 110px 110px;
  gap: 12px;
  padding: 12px 16px;
  background: var(--light-bg);
  font-size: 13px;
  font-weight: 600;
  color: var(--dark);
}

.todo-row {
  display: grid;
  grid-template-columns: 120px minmax(200px, 1fr) 110px 110px;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  font-size: 13px;
  color: var(--dark);
}

.todo-row > div {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.state-select {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--dark);
  background: white;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
}

.add-todo {
  display: grid;
  grid-template-columns: 120px minmax(200px, 1fr) 110px 110px 45px;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  margin-top: 8px;
}

.todo-input {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
}

.todo-time {
  width: 100%;
  box-sizing: border-box;
}

.todo-select {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
}

.add-todo-btn {
  width: 40px;
  height: 32px;
  border: none;
  background: var(--coral);
  color: white;
  border-radius: 4px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.add-todo-btn:hover {
  background: #ff5252;
}
</style>
