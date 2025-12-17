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
import Card from '../components/ui/card.vue'
import CardHeader from '../components/ui/card-header.vue'
import CardTitle from '../components/ui/card-title.vue'
import CardContent from '../components/ui/card-content.vue'
import Button from '../components/ui/button.vue'

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
    let date: Date
    // Handle Firestore Timestamp
    if (dateValue?.toDate) {
      date = dateValue.toDate()
    }
    // Handle Date object
    else if (dateValue instanceof Date) {
      date = dateValue
    }
    // Handle string or timestamp number
    else {
      date = new Date(dateValue)
    }
    
    if (isNaN(date.getTime())) {
      return '-'
    }
    
    // Format as English month day, year (e.g., "January 15, 2025")
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
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
  <div class="flex h-screen bg-background overflow-hidden">
    <Sidebar />
    <main class="flex-1 overflow-y-auto transition-all duration-300 ease-in-out">
      <div class="p-6">
        <div class="max-w-7xl mx-auto space-y-6">
          <div class="flex items-center justify-between mb-6">
            <h1 class="text-3xl font-bold">Recommendation Letters</h1>
            <Button @click="showAddRecommenderModal = true">
              + Add Professor
            </Button>
          </div>
          
          <div v-if="recommenders.recommenders.length === 0" class="text-center py-12">
            <p class="text-muted-foreground">No professors added yet. Click "Add Professor" to get started.</p>
          </div>
          
          <div v-else class="space-y-4">
            <Card
              v-for="recommender in recommenders.recommenders" 
              :key="recommender.id"
              class="overflow-hidden"
            >
              <CardHeader>
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <CardTitle class="mb-2">{{ recommender.name }}</CardTitle>
                    <p class="text-sm text-muted-foreground mb-1">{{ recommender.email }}</p>
                    <p v-if="recommender.affiliation" class="text-sm text-muted-foreground">
                      {{ recommender.affiliation }}
                    </p>
                  </div>
                  <div class="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      @click="openEditModal(recommender)"
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      @click="deleteRecommender(recommender)"
                    >
                      🗑️ Delete
                    </Button>
                    <Button
                      size="sm"
                      @click="sendInvitationEmails(recommender)"
                      :disabled="sendingEmails"
                    >
                      {{ sendingEmails ? 'Sending...' : 'Send Invitation' }}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent class="space-y-4">
                <div>
                  <h4 class="text-sm font-semibold mb-3">Schools</h4>
                  <div v-if="lorTasks.getTasksByRecommender(recommender.id!).length === 0" class="text-sm text-muted-foreground py-4">
                    No schools assigned yet.
                  </div>
                  <div v-else class="border rounded-lg overflow-hidden">
                    <table class="w-full">
                      <thead class="bg-muted">
                        <tr>
                          <th class="text-left p-3 text-xs font-semibold">University</th>
                          <th class="text-left p-3 text-xs font-semibold">Official App Portal</th>
                          <th class="text-left p-3 text-xs font-semibold">Due</th>
                          <th class="text-left p-3 text-xs font-semibold">State</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr 
                          v-for="task in lorTasks.getTasksByRecommender(recommender.id!)"
                          :key="task.id"
                          class="border-t"
                        >
                          <td class="p-3">
                            <div class="font-medium text-sm">{{ getTaskDetails(task)?.schoolName || 'Unknown School' }}</div>
                            <div class="text-xs text-muted-foreground">{{ getTaskDetails(task)?.programName || '' }}</div>
                          </td>
                          <td class="p-3">
                            <a 
                              v-if="getTaskDetails(task)?.portalUrl" 
                              :href="getTaskDetails(task)!.portalUrl" 
                              target="_blank"
                              class="text-primary hover:underline text-sm break-all"
                            >
                              {{ getTaskDetails(task)!.portalUrl }}
                            </a>
                            <span v-else class="text-muted-foreground text-sm">-</span>
                          </td>
                          <td class="p-3 text-sm">
                            {{ formatDate(getTaskDetails(task)?.lorDeadline) }}
                          </td>
                          <td class="p-3">
                            <div class="flex items-center gap-2">
                              <div 
                                class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                                :style="{ backgroundColor: getStatusColor(task.status) }"
                              >
                                {{ getStatusIcon(task.status) }}
                              </div>
                              <span class="text-sm">{{ getStatusText(task.status) }}</span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <Button
                    variant="outline"
                    class="w-full mt-3"
                    @click="openAssignSchools(recommender)"
                  >
                    + Add More Schools
                  </Button>
                </div>
              </CardContent>
            </Card>
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
  </div>
</template>
