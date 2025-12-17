<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useApplications } from '../stores/applications'
import { useProjects } from '../stores/projects'
import { useLORTasks } from '../stores/lorTasks'
import Dialog from './ui/dialog.vue'
import DialogHeader from './ui/dialog-header.vue'
import DialogTitle from './ui/dialog-title.vue'
import DialogContent from './ui/dialog-content.vue'
import DialogFooter from './ui/dialog-footer.vue'
import Button from './ui/button.vue'
import Input from './ui/input.vue'
import Card from './ui/card.vue'

interface Props {
  recommenderId: string
  recommenderName: string
}

const props = defineProps<Props>()
const emit = defineEmits(['close'])

const applications = useApplications()
const projects = useProjects()
const lorTasks = useLORTasks()

// Use object instead of Map for better Vue reactivity
const selectedItems = ref<Record<string, { portalUrl: string; dueDate: string }>>({})
const loading = ref(false)

const close = () => {
  emit('close')
}

// Use projects as primary source, applications as fallback
// Projects are the main data source from Home page
const useProjectsAsSource = computed(() => {
  // Always use projects if there are any projects available
  // This ensures Home page projects are always shown
  return projects.projects.length > 0
})

// Get available applications
const availableApps = computed(() => {
  const existingTaskAppIds = new Set(
    lorTasks.getTasksByRecommender(props.recommenderId).map(t => t.applicationId)
  )
  return applications.applications.filter(app => 
    app.id && !existingTaskAppIds.has(app.id)
  )
})

// Get available projects (convert to application format)
const availableProjects = computed(() => {
  const allProjects = projects.projects as any[]
  
  if (allProjects.length === 0) {
    return []
  }
  
  const existingTasks = lorTasks.getTasksByRecommender(props.recommenderId)
  const existingAppIds = new Set(existingTasks.map(t => t.applicationId))
  
  const assignedSchoolPrograms = new Set<string>()
  
  applications.applications.forEach(app => {
    if (app.id && existingAppIds.has(app.id)) {
      const key = `${app.schoolName}|${app.programName}`
      assignedSchoolPrograms.add(key)
    }
  })
  
  const filtered = allProjects.filter((project: any) => {
    if (!project.id) return false
    if (!project.school || !project.program) return false
    
    const schoolProgramKey = `${project.school}|${project.program}`
    return !assignedSchoolPrograms.has(schoolProgramKey)
  })
  
  return filtered
})

// Combined list of items to display
const availableItems = computed(() => {
  if (useProjectsAsSource.value) {
    return availableProjects.value.map((project: any) => ({
      id: `project_${project.id}`,
      schoolName: project.school,
      programName: project.program,
      portalUrl: undefined,
      lorDeadline: undefined,
      type: 'project' as const,
      projectData: project,
      originalProjectId: project.id!
    }))
  } else {
    return availableApps.value.map(app => ({
      id: app.id!,
      schoolName: app.schoolName,
      programName: app.programName,
      portalUrl: app.portalUrl,
      lorDeadline: app.lorDeadline,
      type: 'application' as const,
      projectData: null
    }))
  }
})

const toggleItem = (itemId: string) => {
  const newSelectedItems = { ...selectedItems.value }
  if (newSelectedItems[itemId]) {
    delete newSelectedItems[itemId]
  } else {
    newSelectedItems[itemId] = { portalUrl: '', dueDate: '' }
  }
  selectedItems.value = newSelectedItems
}

const updateItemInfo = (itemId: string, field: 'portalUrl' | 'dueDate', value: string) => {
  const current = selectedItems.value[itemId]
  if (current) {
    selectedItems.value = {
      ...selectedItems.value,
      [itemId]: {
        ...current,
        [field]: value
      }
    }
  }
}

const isItemSelected = (itemId: string) => {
  return !!selectedItems.value[itemId]
}

const getSelectedCount = computed(() => {
  return Object.keys(selectedItems.value).length
})

const save = async () => {
  const selectedKeys = Object.keys(selectedItems.value)
  if (selectedKeys.length === 0) {
    alert('Please select at least one school')
    return
  }
  
  // Validate that all selected items have portal URL and due date
  for (const itemId of selectedKeys) {
    const info = selectedItems.value[itemId]
    if (!info) continue
    if (!info.portalUrl?.trim()) {
      alert('Please fill in the Portal URL for all selected schools')
      return
    }
    if (!info.dueDate?.trim()) {
      alert('Please fill in the Due Date for all selected schools')
      return
    }
  }
  
  try {
    loading.value = true
    
    if (useProjectsAsSource.value) {
      // Create applications from projects first, then create tasks
      // Extract original project IDs from selected items (they have "project_" prefix)
      const selectedProjectIds = Object.keys(selectedItems.value)
        .filter(id => id.startsWith('project_'))
        .map(id => id.replace('project_', ''))
      
      const selectedProjects = availableProjects.value.filter((p: any) => 
        p.id && selectedProjectIds.includes(p.id!)
      )
      
      if (selectedProjects.length === 0) {
        alert('No applications selected')
        return
      }
      
      // Create applications for each selected project with portal and deadline
      const appIds: string[] = []
      for (const project of selectedProjects) {
        const itemKey = `project_${(project as any).id}`
        const itemInfo = selectedItems.value[itemKey]
        if (!itemInfo) {
          console.error('Missing item info for project:', (project as any).id)
          continue
        }
        
        const appData = {
          schoolName: (project as any).school,
          programName: (project as any).program,
          portalUrl: itemInfo.portalUrl || '',
          lorDeadline: itemInfo.dueDate ? new Date(itemInfo.dueDate) : undefined
        }
        
        try {
          const appId = await applications.add(appData)
          if (appId) {
            appIds.push(appId)
          } else {
            console.error('Failed to create application, no ID returned')
          }
        } catch (err) {
          console.error('Error creating application:', err)
          throw err
        }
      }
      
      if (appIds.length === 0) {
        throw new Error('Failed to create any applications')
      }
      
      // Create tasks with the new application IDs
      const tasksToCreate = appIds.map(appId => ({
        recommenderId: props.recommenderId,
        applicationId: appId,
        status: 'not_contacted' as const
      }))
      
      // Add tasks one by one
      await Promise.all(tasksToCreate.map(task => lorTasks.add(task)))
    } else {
      // Use existing applications - check if they exist before updating
      const appIds: string[] = []
      for (const [appId, itemInfo] of Object.entries(selectedItems.value)) {
        // Check if application exists
        const appExists = applications.applications.some(app => app.id === appId)
        
        if (appExists) {
          // Update application with portal URL and deadline
          await applications.update(appId, {
            portalUrl: itemInfo.portalUrl,
            lorDeadline: itemInfo.dueDate ? new Date(itemInfo.dueDate) : undefined
          })
          appIds.push(appId)
        } else {
          // Application doesn't exist, create it instead
          const app = availableApps.value.find(a => a.id === appId)
          if (app) {
            const newAppData = {
              schoolName: app.schoolName,
              programName: app.programName,
              portalUrl: itemInfo.portalUrl,
              lorDeadline: itemInfo.dueDate ? new Date(itemInfo.dueDate) : undefined
            }
            const newAppId = await applications.add(newAppData)
            if (newAppId) {
              appIds.push(newAppId)
            }
          } else {
            console.error('Application not found:', appId)
          }
        }
      }
      
      if (appIds.length === 0) {
        throw new Error('Failed to process any applications')
      }
      
      // Create tasks
      const tasksToCreate = appIds.map(appId => ({
        recommenderId: props.recommenderId,
        applicationId: appId,
        status: 'not_contacted' as const
      }))
      
      // Add tasks one by one
      await Promise.all(tasksToCreate.map(task => lorTasks.add(task)))
    }
    
    close()
  } catch (error: any) {
    console.error('Failed to assign schools:', error)
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    })
    
    // Provide more specific error messages
    let errorMessage = 'Failed to assign schools, please try again'
    if (error?.code === 'permission-denied') {
      errorMessage = 'Permission denied. Please check your Firestore security rules.'
    } else if (error?.message) {
      errorMessage = `Error: ${error.message}`
    }
    
    alert(errorMessage)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  applications.init()
  lorTasks.init()
  projects.init()
})
</script>

<template>
  <Dialog :open="true" @update:open="(val) => !val && close()" class="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Assign Schools to Prof. {{ recommenderName }}</DialogTitle>
    </DialogHeader>
    
    <DialogContent class="space-y-4">
      <p class="text-sm text-muted-foreground">
        Select schools that need recommendation letters from this professor:
        <span v-if="useProjectsAsSource" class="text-primary italic">(Using applications from Home page)</span>
      </p>
      
      <div v-if="availableItems.length === 0" class="text-center py-8 text-muted-foreground">
        <p v-if="projects.loading">Loading applications...</p>
        <p v-else-if="useProjectsAsSource && projects.projects.length === 0">
          No applications found. Please create applications on the Home page first.
        </p>
        <p v-else>
          No available schools. All schools have been assigned to this professor.
        </p>
      </div>
      
      <div v-else class="space-y-3 max-h-[60vh] overflow-y-auto">
        <Card
          v-for="item in availableItems" 
          :key="item.id"
          :class="`p-4 cursor-pointer transition-colors ${isItemSelected(item.id) ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`"
          @click="toggleItem(item.id)"
        >
          <div class="flex items-start gap-3">
            <input 
              type="checkbox" 
              :checked="isItemSelected(item.id)"
              @change="toggleItem(item.id)"
              @click.stop
              class="mt-1 w-5 h-5 cursor-pointer"
            />
            <div class="flex-1">
              <div class="font-semibold mb-1">{{ item.schoolName }}</div>
              <div class="text-sm text-muted-foreground">{{ item.programName }}</div>
              
              <div v-if="isItemSelected(item.id)" class="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold">Official App Portal *</label>
                  <Input 
                    type="url"
                    :value="selectedItems[item.id]?.portalUrl || ''"
                    @update:value="(val) => updateItemInfo(item.id, 'portalUrl', val)"
                    placeholder="https://..."
                    @click.stop
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold">Due Date *</label>
                  <div class="relative">
                    <Input 
                      type="date"
                      :value="selectedItems[item.id]?.dueDate || ''"
                      @update:value="(val) => updateItemInfo(item.id, 'dueDate', val)"
                      @click.stop
                      lang="en-US"
                      :class="`pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer ${!selectedItems[item.id]?.dueDate ? 'text-transparent' : ''}`"
                    />
                    <span 
                      v-if="!selectedItems[item.id]?.dueDate" 
                      class="absolute left-3 text-muted-foreground text-sm"
                      style="top: 50%; transform: translateY(-50%); pointer-events: none;"
                    >
                      yyyy/mm/dd
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </DialogContent>
    
    <DialogFooter>
      <Button variant="outline" @click="close">Cancel</Button>
      <Button @click="save" :disabled="loading || getSelectedCount === 0">
        {{ loading ? 'Assigning...' : 'Send Rec Request Emails' }}
      </Button>
    </DialogFooter>
  </Dialog>
</template>
