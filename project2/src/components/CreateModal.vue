<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProjects } from '../stores/projects'
import { searchSchools, searchProfs, type Professor } from '../utils/data'
import Dialog from './ui/dialog.vue'
import DialogHeader from './ui/dialog-header.vue'
import DialogTitle from './ui/dialog-title.vue'
import DialogContent from './ui/dialog-content.vue'
import DialogFooter from './ui/dialog-footer.vue'
import Button from './ui/button.vue'
import Input from './ui/input.vue'
import Select from './ui/select.vue'
import Badge from './ui/badge.vue'
import { useAuth } from '../stores/auth'
import { updateReminderRecord } from '../services/todoReminderService'

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

interface Props {
  editData?: any
}

const props = defineProps<Props>()
const emit = defineEmits(['close'])

const projects = useProjects()
const auth = useAuth()

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
  [{ time: '', task: '', state: 'Pending', frequency: 'Medium' }])

// Subfield selection - user can manually select
const commonSubfields = [
  'NLP', 'ML', 'CV', 'PL', 'Software Engineering', 'Systems', 
  'HCI', 'Theory', 'Graphics', 'Social Computing', 'Security',
  'Networks', 'Databases', 'AI', 'Robotics', 'Bioinformatics'
]
const selectedSubfields = ref<string[]>(
  props.editData?.subfield 
    ? (Array.isArray(props.editData.subfield) ? props.editData.subfield : [props.editData.subfield])
    : []
)

const toggleSubfield = (subfield: string) => {
  const index = selectedSubfields.value.indexOf(subfield)
  if (index > -1) {
    selectedSubfields.value.splice(index, 1)
  } else {
    selectedSubfields.value.push(subfield)
  }
}

// Custom subfield input
const customSubfieldInput = ref('')

const addCustomSubfield = () => {
  const trimmed = customSubfieldInput.value.trim()
  if (trimmed && !selectedSubfields.value.includes(trimmed) && !commonSubfields.includes(trimmed)) {
    selectedSubfields.value.push(trimmed)
    customSubfieldInput.value = ''
  }
}

const removeSubfield = (subfield: string) => {
  const index = selectedSubfields.value.indexOf(subfield)
  if (index > -1) {
    selectedSubfields.value.splice(index, 1)
  }
}

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
  // Don't auto-set subfields, let user choose manually
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

const handleDatePickerChange = async (index: number, event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.value) {
    todos.value[index].time = fromDateInputFormat(target.value)
  } else {
    todos.value[index].time = ''
  }
  
  // Update reminder record when deadline changes
  if (props.editData?.id && auth.user?.uid && todos.value[index].frequency && todos.value[index].time) {
    const frequency = todos.value[index].frequency
    if (frequency === 'High' || frequency === 'Medium' || frequency === 'Low') {
      await updateReminderRecord(
        props.editData.id,
        index,
        auth.user.uid,
        todos.value[index].time,
        frequency as 'High' | 'Medium' | 'Low'
      )
    }
  }
}

const addTodo = () => {
  todos.value.push({ time: '', task: '', state: 'Pending', frequency: 'Medium' })
}

const removeTodo = (idx: number) => {
  if (todos.value.length > 1) {
    todos.value.splice(idx, 1)
  }
}

const save = async () => {
  if (!selectedSchool.value || !selectedProf.value) return
  
  const projectData = {
    school: selectedSchool.value,
    program: 'Computer Science',
    professor: selectedProf.value.name,
    homepage: selectedProf.value.homepage,
    scholarid: selectedProf.value.scholarid,
    subfield: selectedSubfields.value.length > 0 
      ? (selectedSubfields.value.length === 1 ? selectedSubfields.value[0] : selectedSubfields.value)
      : undefined,
    todos: todos.value.filter(t => t.task.trim())
  }
  
  try {
    if (props.editData?.id) {
      await projects.update(props.editData.id, projectData)
    } else {
      await projects.add(projectData)
    }
    emit('close')
  } catch (error) {
    console.error('Failed to save application:', error)
    alert('Failed to save application. Please try again.')
  }
}
</script>

<template>
  <Dialog :open="true" @update:open="(val: boolean) => !val && emit('close')" class="max-w-4xl">
    <DialogHeader>
      <DialogTitle>{{ editData ? 'Edit Application' : 'Create New Application' }}</DialogTitle>
    </DialogHeader>
    
    <DialogContent class="space-y-6">
      <!-- School and Professor Selection -->
      <div class="grid grid-cols-2 gap-4">
        <!-- School Field -->
        <div class="space-y-2">
          <label class="text-sm font-semibold">School</label>
          <div v-if="!selectedSchool" class="relative">
            <Input
              :value="schoolSearch"
              @update:value="(val: string) => schoolSearch = val"
              placeholder="Search school..."
            />
            <div v-if="schoolResults.length > 0" class="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
              <div 
                v-for="s in schoolResults"
                :key="s"
                class="p-3 hover:bg-muted cursor-pointer transition-colors"
                @click="selectSchool(s)"
              >
                <div class="text-sm font-medium">{{ s }}</div>
              </div>
            </div>
          </div>
          <div v-else class="flex items-center justify-between p-3 border border-primary rounded-md bg-primary/5">
            <span class="text-sm font-semibold">{{ selectedSchool }}</span>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6"
              @click="selectedSchool = null; selectedProf = null"
            >
              ×
            </Button>
          </div>
        </div>
        
        <!-- Professor Field -->
        <div class="space-y-2">
          <label class="text-sm font-semibold">Professor</label>
          <div v-if="!selectedProf" class="relative">
            <Input
              :value="profSearch"
              @update:value="(val: string) => profSearch = val"
              :placeholder="profEnabled ? 'Search professor...' : 'Select school first'"
              :disabled="!profEnabled"
            />
            <div v-if="profResults.length > 0" class="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
              <div 
                v-for="p in profResults"
                :key="p.name"
                class="p-3 hover:bg-muted cursor-pointer transition-colors"
                @click="selectProf(p)"
              >
                <div class="text-sm font-medium">{{ p.name }}</div>
              </div>
            </div>
          </div>
          <div v-else class="flex items-center justify-between p-3 border border-primary rounded-md bg-primary/5">
            <span class="text-sm font-semibold">{{ selectedProf.name }}</span>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6"
              @click="selectedProf = null"
            >
              ×
            </Button>
          </div>
        </div>
      </div>
      
      <!-- Personal Homepage -->
      <div class="space-y-2">
        <label class="text-sm font-semibold">Personal Homepage</label>
        <div class="p-4 bg-muted rounded-md min-h-[60px]">
          <a v-if="selectedProf?.homepage" :href="selectedProf.homepage" target="_blank" class="text-primary hover:underline">
            {{ selectedProf.homepage }}
          </a>
          <span v-else class="text-muted-foreground italic">Select a professor to see their homepage</span>
        </div>
      </div>
      
      <!-- Subfield Selection -->
      <div class="space-y-3">
        <label class="text-sm font-semibold">Subfield(s)</label>
        
        <!-- Selected Subfields Display -->
        <div v-if="selectedSubfields.length > 0" class="flex flex-wrap gap-2 p-3 border rounded-md min-h-[60px]">
          <Badge
            v-for="subfield in selectedSubfields"
            :key="subfield"
            class="bg-primary text-primary-foreground border-primary border cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
            @click="removeSubfield(subfield)"
          >
            {{ subfield }}
            <span class="text-xs">×</span>
          </Badge>
        </div>
        <div v-else class="p-3 border rounded-md min-h-[60px] flex items-center">
          <span class="text-sm text-muted-foreground italic">No subfields selected</span>
        </div>
        
        <!-- Common Subfields to Select -->
        <div>
          <p class="text-xs text-muted-foreground mb-2">Common Subfields:</p>
          <div class="flex flex-wrap gap-2 p-3 border rounded-md min-h-[60px]">
            <div
              v-for="subfield in commonSubfields"
              :key="subfield"
              class="cursor-pointer"
              @click="toggleSubfield(subfield)"
            >
              <Badge
                :class="selectedSubfields.includes(subfield) 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-muted text-muted-foreground border-muted'"
                class="border hover:opacity-80 transition-opacity"
              >
                {{ subfield }}
              </Badge>
            </div>
          </div>
        </div>
        
        <!-- Custom Subfield Input -->
        <div class="flex gap-2">
          <Input
            :value="customSubfieldInput"
            @update:value="(val: string) => customSubfieldInput = val"
            @keyup.enter="addCustomSubfield"
            placeholder="Enter custom subfield..."
            class="flex-1"
          />
          <Button
            variant="outline"
            @click="addCustomSubfield"
            :disabled="!customSubfieldInput.trim()"
          >
            Add
          </Button>
        </div>
      </div>
      
      <!-- To-Do List -->
      <div class="space-y-3">
        <label class="text-sm font-semibold">To-Do List</label>
        <div class="border rounded-lg overflow-hidden">
          <!-- Table Header -->
          <div class="grid grid-cols-[150px_1fr_110px_110px_50px] gap-3 p-3 bg-muted text-xs font-semibold text-foreground">
            <div>Time</div>
            <div>Task</div>
            <div>State</div>
            <div>Frequency</div>
            <div></div>
          </div>
          <!-- Todo Rows -->
          <div 
            v-for="(todo, i) in todos"
            :key="i"
            class="grid grid-cols-[150px_1fr_110px_110px_50px] gap-3 p-3 border-t text-sm items-center"
          >
            <input
              type="date"
              :value="toDateInputFormat(todo.time)"
              @change="handleDatePickerChange(i, $event)"
              @input="handleDatePickerChange(i, $event)"
              class="h-8 text-xs border border-input rounded-md px-2 bg-background text-foreground"
            />
            <Input 
              :value="todo.task" 
              @update:value="(val: string) => todo.task = val" 
              placeholder="Task" 
              class="h-8 text-xs" 
            />
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
                @update:value="(val: string) => todo.state = val"
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
                @update:value="async (val: string) => {
                  todo.frequency = val
                  // Update reminder record when frequency changes
                  if (editData?.id && auth.user?.uid && todo.time && (val === 'High' || val === 'Medium' || val === 'Low')) {
                    await updateReminderRecord(editData.id, i, auth.user.uid, todo.time, val as 'High' | 'Medium' | 'Low')
                  }
                }"
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
                @click="removeTodo(i)"
                :disabled="todos.length === 1"
              >
                ×
              </Button>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          class="w-full"
          @click="addTodo"
        >
          + Add Row
        </Button>
      </div>
    </DialogContent>
    
    <DialogFooter>
      <Button variant="outline" @click="emit('close')">Cancel</Button>
      <Button @click="save">{{ editData ? 'Update' : 'Save' }}</Button>
    </DialogFooter>
  </Dialog>
</template>
