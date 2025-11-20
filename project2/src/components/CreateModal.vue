<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProjects } from '../stores/projects'
import { searchSchools, searchProfs, type Professor } from '../utils/data'

interface Props {
  editData?: any
}

const props = defineProps<Props>()
const emit = defineEmits(['close'])
const projects = useProjects()

const schoolSearch = ref('')
const profSearch = ref('')
const selectedSchool = ref<string | null>(props.editData?.school || null)
const selectedProf = ref<Professor | null>(
  props.editData ? { 
    name: props.editData.professor,
    affiliation: props.editData.school,
    homepage: props.editData.homepage || '',
    scholarid: props.editData.scholarid || ''
  } : null
)
const todos = ref(props.editData?.todos?.length ? [...props.editData.todos] : 
  [{ time: '', task: '', state: 'Pending', frequency: '' }])

const schoolResults = computed(() => searchSchools(schoolSearch.value))
const profResults = computed(() => searchProfs(selectedSchool.value || '', profSearch.value))
const profEnabled = computed(() => !!selectedSchool.value)

const selectSchool = (school: string) => {
  selectedSchool.value = school
  schoolSearch.value = ''
  selectedProf.value = null
}

const selectProf = (prof: Professor) => {
  selectedProf.value = prof
  profSearch.value = ''
}

const addTodo = () => {
  todos.value.push({ time: '', task: '', state: 'Pending', frequency: '' })
}

const removeTodo = (idx: number) => {
  if (todos.value.length > 1) {
    todos.value.splice(idx, 1)
  }
}

const save = () => {
  if (!selectedSchool.value || !selectedProf.value) return
  
  const projectData = {
    id: props.editData?.id || Date.now().toString(),
    school: selectedSchool.value,
    program: 'Computer Science',
    professor: selectedProf.value.name,
    homepage: selectedProf.value.homepage,
    scholarid: selectedProf.value.scholarid,
    todos: todos.value.filter(t => t.task.trim())
  }
  
  if (props.editData) {
    projects.update(props.editData.id, projectData)
  } else {
    projects.add(projectData)
  }
  
  localStorage.setItem('projects', JSON.stringify(projects.projects))
  emit('close')
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="header">
        <h2>{{ editData ? 'Edit Project' : 'Create New Project' }}</h2>
        <button class="close" @click="emit('close')">×</button>
      </div>
      
      <div class="content">
        <div class="row">
          <div class="field">
            <label>School</label>
            <div v-if="!selectedSchool">
              <input 
                v-model="schoolSearch"
                placeholder="Search school..."
                class="input"
              />
              <div v-if="schoolResults.length" class="dropdown">
                <div 
                  v-for="s in schoolResults"
                  :key="s"
                  class="option"
                  @click="selectSchool(s)"
                >
                  <div class="opt-name">{{ s }}</div>
                </div>
              </div>
            </div>
            <div v-else class="selected">
              <div class="sel-info">
                <div class="sel-name">{{ selectedSchool }}</div>
              </div>
              <button class="clear" @click="selectedSchool = null; selectedProf = null">×</button>
            </div>
          </div>
          
          <div class="field">
            <label>Professor</label>
            <div v-if="!selectedProf">
              <input 
                v-model="profSearch"
                :placeholder="profEnabled ? 'Search professor...' : '----'"
                :disabled="!profEnabled"
                class="input"
              />
              <div v-if="profResults.length" class="dropdown">
                <div 
                  v-for="p in profResults"
                  :key="p.name"
                  class="option"
                  @click="selectProf(p)"
                >
                  <div class="opt-name">{{ p.name }}</div>
                </div>
              </div>
            </div>
            <div v-else class="selected">
              <div class="sel-info">
                <div class="sel-name">{{ selectedProf.name }}</div>
              </div>
              <button class="clear" @click="selectedProf = null">×</button>
            </div>
          </div>
        </div>
        
        <div class="field">
          <label>Professor Homepage</label>
          <div class="info-box">
            <a v-if="selectedProf?.homepage" :href="selectedProf.homepage" target="_blank">
              {{ selectedProf.homepage }}
            </a>
            <span v-else class="placeholder">Select a professor to see their homepage</span>
          </div>
        </div>
        
        <div class="field">
          <label>To-Do List</label>
          <div class="table">
            <div class="table-header">
              <div>Time</div>
              <div>Task</div>
              <div>State</div>
              <div>Frequency</div>
              <div></div>
            </div>
            <div 
              v-for="(todo, i) in todos"
              :key="i"
              class="table-row"
            >
              <input v-model="todo.time" placeholder="Date" class="cell-input" />
              <input v-model="todo.task" placeholder="Task" class="cell-input" />
              <select v-model="todo.state" class="cell-input">
                <option>Pending</option>
                <option>Processing</option>
                <option>Finished</option>
              </select>
              <input v-model="todo.frequency" placeholder="Frequency" class="cell-input" />
              <button 
                class="remove"
                @click="removeTodo(i)"
                :disabled="todos.length === 1"
              >×</button>
            </div>
          </div>
          <button class="add-btn" @click="addTodo">+ Add Row</button>
        </div>
      </div>
      
      <div class="footer">
        <button class="btn-cancel" @click="emit('close')">Cancel</button>
        <button class="btn-save" @click="save">{{ editData ? 'Update' : 'Save' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.modal {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.header {
  padding: 24px 32px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h2 {
  font-size: 22px;
  font-weight: 700;
}

.close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--light-bg);
  font-size: 24px;
  color: var(--gray);
  cursor: pointer;
  line-height: 1;
}

.close:hover {
  background: var(--coral);
  color: white;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.field {
  margin-bottom: 20px;
  position: relative;
}

.field label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--dark);
}

.input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
}

.input:disabled {
  background: var(--light-bg);
  cursor: not-allowed;
}

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.option {
  padding: 12px 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.option:hover {
  background: var(--light-bg);
}

.opt-name {
  font-size: 14px;
  font-weight: 500;
}

.selected {
  padding: 12px 14px;
  border: 1px solid var(--coral);
  border-radius: 8px;
  background: rgba(255, 107, 107, 0.04);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sel-name {
  font-size: 14px;
  font-weight: 600;
}

.clear {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: var(--border);
  font-size: 18px;
  color: var(--gray);
  cursor: pointer;
  line-height: 1;
}

.clear:hover {
  background: var(--coral);
  color: white;
}

.info-box {
  padding: 16px;
  background: var(--light-bg);
  border-radius: 8px;
  font-size: 14px;
  min-height: 60px;
}

.info-box a {
  color: var(--coral);
  text-decoration: none;
}

.info-box a:hover {
  text-decoration: underline;
}

.placeholder {
  color: var(--gray);
  font-style: italic;
}

.table {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr 1fr 40px;
  gap: 8px;
  padding: 10px 12px;
  background: var(--light-bg);
  font-size: 13px;
  font-weight: 600;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr 1fr 40px;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
}

.cell-input {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 13px;
}

.remove {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: none;
  background: var(--light-bg);
  font-size: 18px;
  color: var(--gray);
  cursor: pointer;
  line-height: 1;
}

.remove:hover:not(:disabled) {
  background: #fee;
  color: #c00;
}

.remove:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.add-btn {
  margin-top: 10px;
  padding: 8px 16px;
  background: transparent;
  border: 1px dashed var(--border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--gray);
  cursor: pointer;
}

.add-btn:hover {
  border-color: var(--coral);
  color: var(--coral);
}

.footer {
  padding: 20px 32px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel {
  padding: 10px 24px;
  border: 1px solid var(--border);
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.btn-cancel:hover {
  background: var(--light-bg);
}

.btn-save {
  padding: 10px 24px;
  background: var(--coral);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.btn-save:hover {
  background: #ff5252;
}
</style>
