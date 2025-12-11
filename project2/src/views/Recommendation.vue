<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import { useRecommenders } from '../stores/recommenders'
import { useApplications } from '../stores/applications'
import { useProjects } from '../stores/projects'
import { useLORTasks } from '../stores/lorTasks'
import { useLORTokens } from '../stores/lorTokens'
import { useMail } from '../stores/mail'
import Sidebar from '../components/Sidebar.vue'
import AddRecommenderModal from '../components/AddRecommenderModal.vue'
import AssignSchoolsModal from '../components/AssignSchoolsModal.vue'
import type { Recommender } from '../stores/recommenders'

const router = useRouter()
const auth = useAuth()
const recommenders = useRecommenders()
const applications = useApplications()
const projects = useProjects()
const lorTasks = useLORTasks()
const lorTokens = useLORTokens()
const mail = useMail()

const showAddRecommenderModal = ref(false)
const showAssignSchoolsModal = ref(false)
const selectedRecommender = ref<Recommender | null>(null)
const editingRecommender = ref<Recommender | null>(null)
const sendingEmails = ref(false)

const openEditModal = (recommender: Recommender) => {
  editingRecommender.value = recommender
  showAddRecommenderModal.value = true
}

const closeEditModal = () => {
  editingRecommender.value = null
  showAddRecommenderModal.value = false
}

const deleteRecommender = async (recommender: Recommender) => {
  if (!recommender.id) return
  
  // Check if there are any tasks assigned to this recommender
  const tasks = lorTasks.getTasksByRecommender(recommender.id)
  if (tasks.length > 0) {
    const confirmed = confirm(
      `This professor has ${tasks.length} assigned school(s). ` +
      `Deleting will also remove all associated tasks. Are you sure you want to delete?`
    )
    if (!confirmed) return
  } else {
    const confirmed = confirm(`Are you sure you want to delete ${recommender.name}?`)
    if (!confirmed) return
  }
  
  try {
    await recommenders.remove(recommender.id)
    // Also delete associated tasks
    if (tasks.length > 0) {
      await Promise.all(tasks.map(task => {
        if (task.id) {
          return lorTasks.remove(task.id)
        }
      }))
    }
  } catch (error) {
    console.error('Failed to delete recommender:', error)
    alert('Failed to delete professor, please try again')
  }
}

// Check login status
onMounted(async () => {
  if (auth.loading) {
    await new Promise<void>((resolve) => {
      const checkLoading = setInterval(() => {
        if (!auth.loading) {
          clearInterval(checkLoading)
          resolve()
        }
      }, 50)
    })
  }
  
  if (!auth.isAuthenticated) {
    router.push('/')
    return
  }
  
  recommenders.init()
  applications.init()
  projects.init()
  lorTasks.init()
})

const openAssignSchools = (recommender: Recommender) => {
  selectedRecommender.value = recommender
  // Ensure projects are initialized before opening modal
  if (projects.projects.length === 0) {
    projects.init()
  }
  showAssignSchoolsModal.value = true
}

const closeAssignSchools = () => {
  showAssignSchoolsModal.value = false
  selectedRecommender.value = null
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'submitted':
      return '#4caf50' // green
    case 'accepted':
      return '#2196f3' // blue
    case 'invited':
      return '#ff9800' // orange
    default:
      return '#f44336' // red
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'submitted':
      return '✓'
    case 'accepted':
      return '○'
    case 'invited':
      return '●'
    default:
      return '○'
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'submitted':
      return 'Submitted'
    case 'accepted':
      return 'Accepted'
    case 'invited':
      return 'Invited'
    case 'not_contacted':
      return 'Not Contacted'
    default:
      return 'Not Contacted'
  }
}

const getTaskDetails = (task: any) => {
  const app = applications.applications.find(a => a.id === task.applicationId)
  return app || null
}

const formatDate = (dateValue: any) => {
  if (!dateValue) return '-'
  
  try {
    // Handle Firestore Timestamp
    if (dateValue?.toDate) {
      return dateValue.toDate().toLocaleDateString()
    }
    // Handle Date object
    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString()
    }
    // Handle string or timestamp number
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) {
      return '-'
    }
    return date.toLocaleDateString()
  } catch (error) {
    console.error('Error formatting date:', error, dateValue)
    return '-'
  }
}

const sendInvitationEmails = async (recommender: Recommender) => {
  if (!auth.user) return
  
  try {
    sendingEmails.value = true
    
    // Get or create token
    const tokenId = await lorTokens.getOrCreateToken(recommender.id!)
    
    // Get all tasks for this recommender that are not submitted
    const tasks = lorTasks.getTasksByRecommender(recommender.id!)
      .filter(t => t.status !== 'submitted')
    
    if (tasks.length === 0) {
      alert('No pending tasks for this professor')
      return
    }
    
    // Get school details for each task
    const schools = tasks.map(task => {
      const app = getTaskDetails(task)
      return {
        name: app?.schoolName || 'Unknown',
        deadline: app?.lorDeadline,
        portalUrl: app?.portalUrl
      }
    })
    
    // Send email via Trigger Email extension
    // Send to the recommender's email address from the card
    console.log('Sending invitation email to recommender:', {
      id: recommender.id,
      name: recommender.name,
      email: recommender.email,
      schoolsCount: schools.length
    })
    
    const mailId = await mail.sendInvitationEmail(
      recommender.email, // This is the recommender's email from the card
      recommender.name,
      auth.user.email || auth.user.displayName || 'Student',
      tokenId,
      schools
    )
    
    console.log('Email queued for sending, mail ID:', mailId)
    
    // Wait a moment and check email status
    setTimeout(async () => {
      const status = await mail.checkEmailStatus(mailId)
      console.log('Email status:', status)
      if (status?.error) {
        console.error('Email sending error:', status.error)
      }
    }, 2000)
    
    // Update task statuses to 'invited'
    await Promise.all(
      tasks.map(task => 
        lorTasks.update(task.id!, { status: 'invited' })
      )
    )
    
    alert('Invitation email has been queued for sending! Please check:\n1. Firestore mail collection\n2. Extension logs in Firebase Console\n3. Spam folder')
  } catch (error) {
    console.error('Failed to send invitation:', error)
    alert('Failed to send invitation email, please try again')
  } finally {
    sendingEmails.value = false
  }
}
</script>

<template>
  <div class="layout">
    <main class="main">
      <div class="header-section">
        <h1>Recommendation Letters</h1>
        <button class="btn-add-professor" @click="showAddRecommenderModal = true">
          + Add Professor
        </button>
      </div>
      
      <div v-if="recommenders.recommenders.length === 0" class="empty-state">
        <p>No professors added yet. Click "Add Professor" to get started.</p>
      </div>
      
      <div v-else class="recommenders-grid">
        <div 
          v-for="recommender in recommenders.recommenders" 
          :key="recommender.id"
          class="recommender-card"
        >
          <div class="card-header">
            <div class="professor-info">
              <h3>{{ recommender.name }}</h3>
              <p class="email">{{ recommender.email }}</p>
              <p v-if="recommender.affiliation" class="affiliation">{{ recommender.affiliation }}</p>
            </div>
            <div class="card-actions">
              <button 
                class="btn-edit"
                @click="openEditModal(recommender)"
                title="Edit Professor"
              >
                ✏️ Edit
              </button>
              <button 
                class="btn-delete"
                @click="deleteRecommender(recommender)"
                title="Delete Professor"
              >
                🗑️ Delete
              </button>
              <button 
                class="btn-send-invite"
                @click="sendInvitationEmails(recommender)"
                :disabled="sendingEmails"
              >
                {{ sendingEmails ? 'Sending...' : 'Send Invitation' }}
              </button>
            </div>
          </div>
          
          <div class="schools-section">
            <h4>Schools</h4>
            <div v-if="lorTasks.getTasksByRecommender(recommender.id!).length === 0" class="no-schools">
              <p>No schools assigned yet.</p>
            </div>
            <div v-else class="schools-table">
              <table class="schools-table-content">
                <thead>
                  <tr>
                    <th>University</th>
                    <th>Official App Portal</th>
                    <th>Due</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="task in lorTasks.getTasksByRecommender(recommender.id!)"
                    :key="task.id"
                  >
                    <td class="university-cell">
                      <div class="university-name">{{ getTaskDetails(task)?.schoolName || 'Unknown School' }}</div>
                      <div class="program-name">{{ getTaskDetails(task)?.programName || '' }}</div>
                    </td>
                    <td class="portal-cell">
                      <a 
                        v-if="getTaskDetails(task)?.portalUrl" 
                        :href="getTaskDetails(task)!.portalUrl" 
                        target="_blank"
                        class="portal-link"
                      >
                        {{ getTaskDetails(task)!.portalUrl }}
                      </a>
                      <span v-else class="no-portal">-</span>
                    </td>
                    <td class="due-cell">
                      {{ formatDate(getTaskDetails(task)?.lorDeadline) }}
                    </td>
                    <td class="state-cell">
                      <div class="state-container">
                        <div 
                          class="state-indicator" 
                          :style="{ backgroundColor: getStatusColor(task.status) }"
                          :title="task.status.replace('_', ' ').toUpperCase()"
                        >
                          {{ getStatusIcon(task.status) }}
                        </div>
                        <span class="state-text">{{ getStatusText(task.status) }}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button class="btn-add-school-bottom" @click="openAssignSchools(recommender)">
              + Add More Schools
            </button>
          </div>
        </div>
      </div>
    </main>
    
    <AddRecommenderModal 
      v-if="showAddRecommenderModal"
      :recommender="editingRecommender"
      @close="closeEditModal"
    />
    
    <AssignSchoolsModal 
      v-if="showAssignSchoolsModal && selectedRecommender"
      :recommender-id="selectedRecommender.id!"
      :recommender-name="selectedRecommender.name"
      @close="closeAssignSchools"
    />
    <Sidebar />
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.main {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.header-section h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--dark);
}

.btn-add-professor {
  padding: 12px 24px;
  background: var(--coral);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-add-professor:hover {
  background: #ff5252;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--gray);
}

.recommenders-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.recommender-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.card-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.btn-edit {
  padding: 8px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-edit:hover {
  background: #1976d2;
}

.btn-delete {
  padding: 8px 16px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-delete:hover {
  background: #d32f2f;
}

.professor-info h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--dark);
}

.email {
  font-size: 14px;
  color: var(--gray);
  margin-bottom: 4px;
}

.affiliation {
  font-size: 13px;
  color: var(--gray);
}

.btn-send-invite {
  padding: 10px 20px;
  background: var(--coral);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-send-invite:hover:not(:disabled) {
  background: #ff5252;
}

.btn-send-invite:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.schools-section h4 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--dark);
}

.no-schools {
  text-align: center;
  padding: 20px;
  color: var(--gray);
  margin-bottom: 16px;
}

.schools-table {
  margin-bottom: 16px;
  overflow-x: auto;
}

.schools-table-content {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.schools-table-content thead {
  background: var(--light-bg);
}

.schools-table-content th {
  padding: 12px 16px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: var(--dark);
  border-bottom: 2px solid var(--border);
}

.schools-table-content td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.schools-table-content tbody tr:hover {
  background: rgba(255, 107, 107, 0.02);
}

.university-cell {
  min-width: 200px;
}

.university-name {
  font-weight: 600;
  color: var(--dark);
  margin-bottom: 4px;
}

.program-name {
  font-size: 12px;
  color: var(--gray);
}

.portal-cell {
  min-width: 250px;
}

.portal-link {
  color: var(--coral);
  text-decoration: none;
  word-break: break-all;
}

.portal-link:hover {
  text-decoration: underline;
}

.no-portal {
  color: var(--gray);
  font-style: italic;
}

.due-cell {
  min-width: 120px;
  color: var(--dark);
}

.state-cell {
  text-align: center;
  min-width: 60px;
}

.state-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.state-indicator {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
  cursor: help;
  flex-shrink: 0;
}

.state-text {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.btn-add-school-bottom {
  width: 100%;
  padding: 10px;
  background: transparent;
  border: 1px dashed var(--border);
  border-radius: 6px;
  color: var(--coral);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.btn-add-school-bottom:hover {
  border-color: var(--coral);
  background: rgba(255, 107, 107, 0.05);
}
</style>
