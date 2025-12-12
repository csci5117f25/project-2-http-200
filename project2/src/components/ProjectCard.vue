<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useProjects } from '../stores/projects'
import { useAuth } from '../stores/auth'
import Card from './ui/card.vue'
import CardHeader from './ui/card-header.vue'
import CardContent from './ui/card-content.vue'
import Button from './ui/button.vue'
import Badge from './ui/badge.vue'
import Input from './ui/input.vue'
import Select from './ui/select.vue'
import { cn } from '@/lib/utils'
import { getColorClasses } from '../utils/colorTags'
import { updateReminderRecord } from '../services/todoReminderService'

const props = defineProps<{
  data: any
}>()

const emit = defineEmits(['edit'])

const projects = useProjects()
const auth = useAuth()
const expanded = ref(false)
const editingTodo = ref<number | null>(null)
const newTodo = ref({ time: '', task: '', state: 'Pending', frequency: 'Medium' })
const isInitialized = ref(false) // Flag to prevent saving during initialization

// Get localStorage key for current user and project
const getStorageKey = (): string => {
  const userId = auth.user?.uid || 'anonymous'
  const projectId = props.data?.id || 'unknown'
  return `project_card_expanded_${userId}_${projectId}`
}

// Load expanded state from localStorage
const loadExpandedState = () => {
  if (!props.data?.id) return
  
  try {
    const saved = localStorage.getItem(getStorageKey())
    if (saved !== null) {
      expanded.value = JSON.parse(saved)
    }
  } catch (error) {
    console.error('Failed to load expanded state:', error)
  }
}

// Save expanded state to localStorage
const saveExpandedState = () => {
  if (!props.data?.id || !isInitialized.value) return
  
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(expanded.value))
  } catch (error) {
    console.error('Failed to save expanded state:', error)
  }
}

// Watch expanded state and save to localStorage
watch(expanded, () => {
  if (isInitialized.value) {
    saveExpandedState()
  }
})

// Load expanded state on mount
onMounted(() => {
  loadExpandedState()
  isInitialized.value = true
})

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

// Convert MM/DD/YYYY format to YYYY-MM-DD (for date input)
const toDateInputFormat = (value: string | undefined): string => {
  if (!value) return ''
  const parts = value.split('/')
  if (parts.length === 3 && parts[0]?.length === 2 && parts[1]?.length === 2 && parts[2]?.length === 4) {
    return `${parts[2]}-${parts[0]}-${parts[1]}`
  }
  return ''
}

// Convert YYYY-MM-DD format to MM/DD/YYYY
const fromDateInputFormat = (value: string): string => {
  if (!value) return ''
  const parts = value.split('-')
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}/${parts[0]}`
  }
  return ''
}

const handleDateInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  newTodo.value.time = formatDateInput(target.value)
}

const handleDatePickerChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.value) {
    newTodo.value.time = fromDateInputFormat(target.value)
  }
}

const handleExistingTodoDateChange = async (index: number, event: Event) => {
  if (!props.data.todos || !auth.user?.uid) return
  const target = event.target as HTMLInputElement
  const updatedTodos = [...props.data.todos]
  
  if (target.value) {
    updatedTodos[index].time = fromDateInputFormat(target.value)
  } else {
    updatedTodos[index].time = ''
  }
  
  projects.update(props.data.id, { ...props.data, todos: updatedTodos })
  localStorage.setItem('projects', JSON.stringify(projects.projects))
  
  // Update reminder record when deadline changes
  if (updatedTodos[index].time && updatedTodos[index].frequency) {
    const frequency = updatedTodos[index].frequency
    if (frequency === 'High' || frequency === 'Medium' || frequency === 'Low') {
      await updateReminderRecord(
        props.data.id,
        index,
        auth.user.uid,
        updatedTodos[index].time,
        frequency as 'High' | 'Medium' | 'Low'
      )
    }
  }
}

const getStateColor = (state: string): string => {
  switch (state) {
    case 'Pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'Processing':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'Finished':
      return 'bg-green-100 text-green-800 border-green-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const getFrequencyColor = (frequency: string): string => {
  switch (frequency) {
    case 'High':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'Medium':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'Low':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const deleteTodo = (index: number) => {
  if (!props.data.todos) return
  const updatedTodos = [...props.data.todos]
  updatedTodos.splice(index, 1)
  projects.update(props.data.id, { ...props.data, todos: updatedTodos })
  localStorage.setItem('projects', JSON.stringify(projects.projects))
}

const updateTodoState = (index: number, newState: string) => {
  if (!props.data.todos) return
  const updatedTodos = [...props.data.todos]
  updatedTodos[index] = { ...updatedTodos[index], state: newState }
  projects.update(props.data.id, { ...props.data, todos: updatedTodos })
  localStorage.setItem('projects', JSON.stringify(projects.projects))
}

const updateTodoFrequency = async (index: number, newFrequency: string) => {
  if (!props.data.todos || !auth.user?.uid) return
  const updatedTodos = [...props.data.todos]
  const todo = updatedTodos[index]
  updatedTodos[index] = { ...todo, frequency: newFrequency }
  projects.update(props.data.id, { ...props.data, todos: updatedTodos })
  localStorage.setItem('projects', JSON.stringify(projects.projects))
  
  // Update reminder record when frequency changes
  if (todo.time && (newFrequency === 'High' || newFrequency === 'Medium' || newFrequency === 'Low')) {
    await updateReminderRecord(
      props.data.id,
      index,
      auth.user.uid,
      todo.time,
      newFrequency as 'High' | 'Medium' | 'Low'
    )
  }
}

const addNewTodo = () => {
  if (!newTodo.value.task.trim()) return
  const updatedTodos = [...(props.data.todos || [])]
  updatedTodos.push({ ...newTodo.value })
  projects.update(props.data.id, { ...props.data, todos: updatedTodos })
  localStorage.setItem('projects', JSON.stringify(projects.projects))
  newTodo.value = { time: '', task: '', state: 'Pending', frequency: 'Medium' }
}

// Get professor initial for avatar
const getProfessorInitial = computed(() => {
  if (!props.data.professor) return 'P'
  return props.data.professor.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
})

// Get subfields as array
const projectSubfields = computed(() => {
  if (!props.data.subfield) return []
  return Array.isArray(props.data.subfield) ? props.data.subfield : [props.data.subfield]
})
</script>

<template>
  <Card :class="cn('hover:shadow-lg transition-shadow cursor-pointer', expanded && 'mb-4')">
    <CardHeader class="pb-3" @click="expanded = !expanded">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4 flex-1">
          <!-- Professor Avatar -->
          <div class="w-15 h-15 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {{ getProfessorInitial }}
          </div>
          <!-- Professor as Main Entity -->
          <div class="flex-1 min-w-0">
            <h3 class="text-lg font-semibold mb-2 text-foreground">{{ data.professor || 'Unknown Professor' }}</h3>
            <div class="flex items-center gap-2 flex-wrap">
              <!-- School as Field -->
              <Badge v-if="data.school" :class="getColorClasses(data.school, 'schools')" class="border">
                {{ data.school }}
              </Badge>
              <!-- Subfield(s) as Field -->
              <Badge
                v-for="subfield in projectSubfields"
                :key="subfield"
                :class="getColorClasses(subfield, 'subfields')"
                class="border"
              >
                {{ subfield }}
              </Badge>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            class="h-9 w-9"
            @click.stop="emit('edit', data)"
          >
            ✎
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-9 w-9"
          >
            {{ expanded ? '−' : '+' }}
          </Button>
        </div>
      </div>
    </CardHeader>
    
    <CardContent v-if="expanded" class="pt-0 space-y-6">
      <!-- Personal Homepage -->
      <div class="space-y-2">
        <h4 class="text-sm font-semibold text-foreground">Personal Homepage</h4>
        <div class="p-4 bg-muted rounded-md min-h-[60px]">
          <a v-if="data.homepage" :href="data.homepage" target="_blank" class="text-primary hover:underline">
            {{ data.homepage }}
          </a>
          <span v-else class="text-muted-foreground italic">No homepage available</span>
        </div>
      </div>
      
      <!-- To-Do List -->
      <div class="space-y-3">
        <h4 class="text-sm font-semibold text-foreground">To-Do List</h4>
        
        <div class="border rounded-lg overflow-hidden">
          <!-- Table Header - Always visible -->
          <div class="grid grid-cols-[150px_1fr_110px_110px_50px] gap-3 p-3 bg-muted text-xs font-semibold text-foreground">
            <div>Time</div>
            <div>Task</div>
            <div>State</div>
            <div>Frequency</div>
            <div></div>
          </div>
          
          <!-- Todo Rows -->
          <div 
            v-for="(todo, i) in (data.todos || [])" 
            :key="i"
            class="grid grid-cols-[150px_1fr_110px_110px_50px] gap-3 p-3 border-t text-sm items-center"
          >
            <div>
              <input
                type="date"
                :value="toDateInputFormat(todo.time)"
                @change="handleExistingTodoDateChange(i, $event)"
                @input="handleExistingTodoDateChange(i, $event)"
                class="h-8 text-xs border border-input rounded-md px-2 bg-background text-foreground w-full"
              />
            </div>
            <div class="truncate">{{ todo.task }}</div>
            <div class="relative flex items-center">
              <Badge 
                :class="getStateColor(todo.state || 'Pending')"
                class="text-xs font-medium border cursor-pointer flex items-center gap-1 pr-6"
              >
                {{ todo.state || 'Pending' }}
                <span class="text-[10px] opacity-70">▼</span>
              </Badge>
              <Select 
                :value="todo.state || 'Pending'" 
                @update:value="(val: string) => updateTodoState(i, val)"
                class="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
              >
                <option>Pending</option>
                <option>Processing</option>
                <option>Finished</option>
              </Select>
            </div>
            <div class="relative flex items-center">
              <Badge 
                :class="getFrequencyColor(todo.frequency || 'Medium')"
                class="text-xs font-medium border cursor-pointer flex items-center gap-1 pr-6"
              >
                {{ todo.frequency || 'Medium' }}
                <span class="text-[10px] opacity-70">▼</span>
              </Badge>
              <Select 
                :value="todo.frequency || 'Medium'" 
                @update:value="(val: string) => updateTodoFrequency(i, val)"
                class="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </Select>
            </div>
            <div class="flex items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                @click="deleteTodo(i)"
              >
                ×
              </Button>
            </div>
          </div>
          
          <!-- Empty state message -->
          <div v-if="!data.todos || data.todos.length === 0" class="p-4 text-center text-sm text-muted-foreground border-t">
            No tasks yet. Add one below.
          </div>
        </div>
        
        <!-- Add Todo Form -->
        <div class="grid grid-cols-[150px_1fr_110px_110px_50px] gap-3 p-3 border rounded-lg bg-muted/30">
          <input
            type="date"
            :value="toDateInputFormat(newTodo.time)"
            @change="handleDatePickerChange"
            @input="handleDatePickerChange"
            class="h-8 text-xs border border-input rounded-md px-2 bg-background text-foreground"
          />
          <Input
            :value="newTodo.task"
            @update:value="(val: string) => newTodo.task = val"
            placeholder="Task"
            class="h-8 text-xs"
          />
          <div class="relative flex items-center">
            <Badge 
              :class="getStateColor(newTodo.state)"
              class="text-xs font-medium border cursor-pointer flex items-center gap-1 pr-6"
            >
              {{ newTodo.state }}
              <span class="text-[10px] opacity-70">▼</span>
            </Badge>
            <Select 
              :value="newTodo.state" 
              @update:value="(val: string) => newTodo.state = val"
              class="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
            >
              <option>Pending</option>
              <option>Processing</option>
              <option>Finished</option>
            </Select>
          </div>
          <div class="relative flex items-center">
            <Badge 
              :class="getFrequencyColor(newTodo.frequency)"
              class="text-xs font-medium border cursor-pointer flex items-center gap-1 pr-6"
            >
              {{ newTodo.frequency }}
              <span class="text-[10px] opacity-70">▼</span>
            </Badge>
            <Select 
              :value="newTodo.frequency" 
              @update:value="(val: string) => newTodo.frequency = val"
              class="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
            >
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </Select>
          </div>
          <Button
            size="icon"
            class="h-8 w-10"
            @click="addNewTodo"
          >
            +
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
