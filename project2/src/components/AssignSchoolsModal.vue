<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useApplications } from '../stores/applications'
import { useProjects } from '../stores/projects'
import { useLORTasks } from '../stores/lorTasks'

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
        alert('No projects selected')
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
  <div class="overlay" @click.self="close">
    <div class="modal" @click.stop>
      <div class="header">
        <h2>Assign Schools to Prof. {{ recommenderName }}</h2>
        <button class="close" @click="close">×</button>
      </div>
      
      <div class="content">
        <p class="hint">
          Select schools that need recommendation letters from this professor:
          <span v-if="useProjectsAsSource" class="source-hint">(Using projects from Home page)</span>
        </p>
        
        <div v-if="availableItems.length === 0" class="empty">
          <p v-if="projects.loading">Loading projects...</p>
          <p v-else-if="useProjectsAsSource && projects.projects.length === 0">
            No projects found. Please create projects on the Home page first.
          </p>
          <p v-else>
            No available schools. All schools have been assigned to this professor.
          </p>
        </div>
        
        <div v-else class="schools-list">
          <div 
            v-for="item in availableItems" 
            :key="item.id"
            class="school-item"
            :class="{ selected: isItemSelected(item.id) }"
          >
            <div class="checkbox-section">
              <input 
                type="checkbox" 
                :checked="isItemSelected(item.id)"
                @change="toggleItem(item.id)"
                @click.stop
                class="checkbox-input"
              />
              <div class="school-info" @click.stop>
                <div class="school-name">{{ item.schoolName }}</div>
                <div class="program">{{ item.programName }}</div>
              </div>
            </div>
            
            <div v-if="isItemSelected(item.id)" class="form-fields">
              <div class="field">
                <label>Official App Portal *</label>
                <input 
                  type="url"
                  :value="selectedItems[item.id]?.portalUrl || ''"
                  @input="updateItemInfo(item.id, 'portalUrl', ($event.target as HTMLInputElement).value)"
                  placeholder="https://..."
                  class="input-field"
                />
              </div>
              <div class="field">
                <label>Due Date *</label>
                <input 
                  type="date"
                  :value="selectedItems[item.id]?.dueDate || ''"
                  @input="updateItemInfo(item.id, 'dueDate', ($event.target as HTMLInputElement).value)"
                  class="input-field"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <button class="btn-cancel" @click="close">Cancel</button>
        <button class="btn-save" @click="save" :disabled="loading || getSelectedCount === 0">
          {{ loading ? 'Assigning...' : 'Send Rec Request Emails' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.modal {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 700px;
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

.hint {
  margin-bottom: 20px;
  color: var(--gray);
  font-size: 14px;
}

.source-hint {
  font-size: 12px;
  color: var(--coral);
  font-style: italic;
}

.empty {
  padding: 40px;
  text-align: center;
  color: var(--gray);
}

.schools-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.school-item {
  padding: 16px;
  border: 2px solid var(--border);
  border-radius: 8px;
  transition: all 0.2s;
  margin-bottom: 12px;
}

.school-item:hover {
  border-color: var(--coral);
  background: rgba(255, 107, 107, 0.02);
}

.school-item.selected {
  border-color: var(--coral);
  background: rgba(255, 107, 107, 0.05);
}

.checkbox-section {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.checkbox-input {
  width: 20px;
  height: 20px;
  cursor: pointer;
  margin-top: 4px;
  flex-shrink: 0;
}

.form-fields {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
}

.field label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--dark);
}

.input-field {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
}

.input-field:focus {
  outline: none;
  border-color: var(--coral);
}

.school-info {
  flex: 1;
}

.school-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--dark);
}

.program {
  font-size: 14px;
  color: var(--gray);
  margin-bottom: 8px;
}

.portal {
  font-size: 13px;
  margin-bottom: 4px;
}

.portal a {
  color: var(--coral);
  text-decoration: none;
}

.portal a:hover {
  text-decoration: underline;
}

.deadline {
  font-size: 12px;
  color: var(--gray);
  font-weight: 500;
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

.btn-save:hover:not(:disabled) {
  background: #ff5252;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

