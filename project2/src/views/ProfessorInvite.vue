<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc, collection, query, where, getDocs, updateDoc, Timestamp, addDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useLORTokens } from '../stores/lorTokens'
import type { LORStatus } from '../stores/lorTasks'

const route = useRoute()

const lorTokens = useLORTokens()

const tokenId = ref<string>('')
const tokenValid = ref(false)
const loading = ref(true)
const error = ref('')
const showThankYou = ref(false)
const completionTime = ref<Date | null>(null)

const studentInfo = ref<{ name: string; email: string; userId: string } | null>(null)
const recommenderInfo = ref<{ name: string; email: string } | null>(null)
const tasks = ref<any[]>([])
const applications = ref<any[]>([])

// Check if all tasks are submitted
const allTasksSubmitted = computed(() => {
  return tasks.value.length > 0 && tasks.value.every(t => t.status === 'submitted')
})

// Update task status: toggle between 'accepted' (shown as pending) and 'submitted'
const toggleTaskStatus = async (taskId: string) => {
  try {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return
    
    // Toggle between 'accepted' (pending) and 'submitted'
    const newStatus: LORStatus = task.status === 'submitted' ? 'accepted' : 'submitted'
    
    const taskRef = doc(db, 'lorTasks', taskId)
    await updateDoc(taskRef, { 
      status: newStatus,
      lastUpdated: Timestamp.now()
    })
    
    // Update local state
    task.status = newStatus
  } catch (error) {
    console.error('Failed to update task status:', error)
    alert('Failed to update status, please try again')
  }
}

// Send completion notification to student
const sendCompletionEmail = async () => {
  if (!studentInfo.value || !recommenderInfo.value) return
  
  try {
    const completionDetails = tasks.value.map(task => {
      const app = getApplicationDetails(task.applicationId)
      return {
        school: app?.schoolName || 'Unknown',
        program: app?.programName || 'N/A',
        deadline: app?.lorDeadline ? new Date(app.lorDeadline).toLocaleDateString() : 'N/A',
        portalUrl: app?.portalUrl || ''
      }
    })
    
    const completionTimeStr = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #4caf50;">Recommendation Letters Completed</h2>
  <p>Dear ${studentInfo.value.name},</p>
  <p>Great news! Prof. ${recommenderInfo.value.name} has completed all recommendation letters.</p>
  <p><strong>Completion Time:</strong> ${completionTimeStr}</p>
  <h3>Completed Letters:</h3>
  <ul style="padding-left: 20px;">
    ${completionDetails.map(detail => `
      <li>
        <strong>${detail.school}</strong> - ${detail.program}<br/>
        Deadline: ${detail.deadline}<br/>
        ${detail.portalUrl ? `<a href="${detail.portalUrl}">Portal Link</a>` : ''}
      </li>
    `).join('')}
  </ul>
  <p>Thank you for using PhD App Hub!</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="font-size: 12px; color: #999;">This is an automated email from PhD App Hub.</p>
</body>
</html>`
    
    const textContent = `
Recommendation Letters Completed

Dear ${studentInfo.value.name},

Great news! Prof. ${recommenderInfo.value.name} has completed all recommendation letters.

Completion Time: ${completionTimeStr}

Completed Letters:
${completionDetails.map(d => `- ${d.school} - ${d.program} (Deadline: ${d.deadline})`).join('\n')}

Thank you for using PhD App Hub!
    `
    
    const mailTask = {
      to: studentInfo.value.email,
      message: {
        subject: `Recommendation Letters Completed by Prof. ${recommenderInfo.value.name}`,
        html: htmlContent,
        text: textContent
      }
    }
    
    await addDoc(collection(db, 'mail'), mailTask)
    console.log('Completion email sent to student')
  } catch (error) {
    console.error('Failed to send completion email:', error)
  }
}

// Complete submission
const completeSubmission = async () => {
  if (!allTasksSubmitted.value) return
  
  try {
    completionTime.value = new Date()
    
    // Send completion email to student
    await sendCompletionEmail()
    
    // Show thank you page
    showThankYou.value = true
  } catch (error) {
    console.error('Failed to complete submission:', error)
    alert('Failed to complete submission, please try again')
  }
}

const getApplicationDetails = (applicationId: string) => {
  return applications.value.find(a => a.id === applicationId)
}

const loadTokenData = async () => {
  const token = route.params.tokenId as string
  if (!token) {
    error.value = 'Invalid invitation link'
    loading.value = false
    return
  }
  
  tokenId.value = token
  
  try {
    // Validate token
    const tokenData = await lorTokens.validateToken(token)
    
    if (!tokenData) {
      error.value = 'Invalid or expired invitation link'
      loading.value = false
      return
    }
    
    tokenValid.value = true
    
    // Get recommender info
    const recommenderDoc = await getDoc(doc(db, 'recommenders', tokenData.recommenderId))
    
    if (recommenderDoc.exists()) {
      const recommenderData = recommenderDoc.data()
      recommenderInfo.value = {
        name: recommenderData.name,
        email: recommenderData.email
      }
    }
    
    // Get student info from token data (email is stored in token)
    // Student email is the Google login email
    studentInfo.value = {
      name: tokenData.userEmail?.split('@')[0] || 'Student',
      email: tokenData.userEmail || '',
      userId: tokenData.userId
    }
    
    // If email is not in token, try to get from users collection as fallback
    if (!studentInfo.value.email) {
      try {
        const userDoc = await getDoc(doc(db, 'users', tokenData.userId))
        if (userDoc.exists()) {
          const userData = userDoc.data()
          studentInfo.value.email = userData.email || ''
          studentInfo.value.name = userData.name || userData.email?.split('@')[0] || 'Student'
        }
      } catch (err) {
        console.log('Could not fetch user email from users collection')
      }
    }
    
    // Load tasks for this recommender directly from Firestore
    const tasksRef = collection(db, 'lorTasks')
    const tasksQuery = query(tasksRef, where('recommenderId', '==', tokenData.recommenderId))
    const tasksSnapshot = await getDocs(tasksQuery)
    
    const loadedTasks = tasksSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        status: data.status as LORStatus,
        lastUpdated: data.lastUpdated?.toDate?.() || data.lastUpdated,
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      } as any
    })
    
    // When professor clicks the link, automatically set all non-submitted tasks to 'accepted'
    // This happens only once when the page loads
    const tasksToUpdate = loadedTasks.filter((task: any) => 
      task.status !== 'submitted' && task.status !== 'accepted'
    )
    
    if (tasksToUpdate.length > 0) {
      await Promise.all(
        tasksToUpdate.map((task: any) => 
          updateDoc(doc(db, 'lorTasks', task.id), {
            status: 'accepted' as LORStatus,
            lastUpdated: Timestamp.now()
          })
        )
      )
      
      // Update local state
      loadedTasks.forEach((task: any) => {
        if (task.status !== 'submitted' && task.status !== 'accepted') {
          task.status = 'accepted'
        }
      })
    }
    
    tasks.value = loadedTasks
    
    // Load applications for this user directly from Firestore
    const applicationsRef = collection(db, 'applications')
    const applicationsQuery = query(applicationsRef, where('userId', '==', tokenData.userId))
    const applicationsSnapshot = await getDocs(applicationsQuery)
    
    const loadedApplications = applicationsSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        lorDeadline: data.lorDeadline?.toDate?.() || data.lorDeadline,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      }
    })
    applications.value = loadedApplications
    
  } catch (err) {
    console.error('Failed to load token data:', err)
    error.value = 'Failed to load invitation data'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTokenData()
})
</script>

<template>
  <div class="container">
    <div v-if="loading" class="loading">
      <p>Loading...</p>
    </div>
    
    <div v-else-if="error" class="error">
      <h2>Invalid Invitation</h2>
      <p>{{ error }}</p>
      <p class="help-text">Please contact the student if you believe this is an error.</p>
    </div>
    
    <div v-else-if="tokenValid" class="content">
      <div class="header">
        <h1>Recommendation Letter Request</h1>
        <div class="student-info" v-if="studentInfo">
          <p><strong>From:</strong> {{ studentInfo.name }}</p>
          <p v-if="studentInfo.email"><strong>Email:</strong> {{ studentInfo.email }}</p>
        </div>
      </div>
      
      <div class="intro">
        <p>Dear Prof. {{ recommenderInfo?.name }},</p>
        <p>Thank you for agreeing to write recommendation letters. Below are the applications that require your recommendation:</p>
      </div>
      
      <div class="tasks-section">
        <h2>Recommendation Letters</h2>
        <div v-if="tasks.length === 0" class="no-tasks">
          <p>No tasks found.</p>
        </div>
        <div v-else class="tasks-list">
          <div 
            v-for="task in tasks"
            :key="task.id"
            class="task-item"
          >
            <div class="task-checkbox">
              <input 
                type="checkbox"
                :checked="task.status === 'submitted'"
                @change="toggleTaskStatus(task.id)"
                class="checkbox"
              />
            </div>
            <div class="task-content">
              <div class="task-header-row">
                <h3 class="task-school">{{ getApplicationDetails(task.applicationId)?.schoolName || 'Unknown School' }}</h3>
                <div class="task-status-badge" :class="task.status === 'submitted' ? 'status-submitted' : 'status-pending'">
                  {{ task.status === 'submitted' ? 'Submitted' : 'Pending' }}
                </div>
              </div>
              <div class="task-info">
                <div class="info-row">
                  <span class="info-label">Application:</span>
                  <span class="info-value">{{ getApplicationDetails(task.applicationId)?.programName || 'N/A' }}</span>
                </div>
                <div v-if="getApplicationDetails(task.applicationId)?.lorDeadline" class="info-row">
                  <span class="info-label">Due:</span>
                  <span class="info-value">{{ new Date(getApplicationDetails(task.applicationId)!.lorDeadline!).toLocaleDateString() }}</span>
                </div>
                <div v-if="getApplicationDetails(task.applicationId)?.portalUrl" class="info-row">
                  <span class="info-label">Portal:</span>
                  <a :href="getApplicationDetails(task.applicationId)!.portalUrl" target="_blank" class="info-link">
                    {{ getApplicationDetails(task.applicationId)!.portalUrl }}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <div v-if="allTasksSubmitted" class="completion-section">
          <button @click="completeSubmission" class="complete-btn">
            Finish Submission
          </button>
        </div>
        <p v-else class="note">You can update the status of each recommendation letter above. The student will be able to see these updates in real-time.</p>
      </div>
    </div>
    
    <!-- Thank You Page -->
    <div v-if="showThankYou" class="thank-you-page">
      <div class="thank-you-content">
        <div class="thank-you-icon">✓</div>
        <h1>Thank You!</h1>
        <p class="thank-you-message">
          All recommendation letters have been submitted successfully.
        </p>
        <p v-if="completionTime" class="completion-time">
          Completion Time: {{ completionTime.toLocaleString('zh-CN') }}
        </p>
        <p class="thank-you-note">
          The student has been notified and will receive a detailed completion email.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 40px 20px;
}

.loading,
.error {
  max-width: 600px;
  margin: 0 auto;
  background: white;
  padding: 40px;
  border-radius: 12px;
  text-align: center;
}

.error h2 {
  color: #f44336;
  margin-bottom: 16px;
}

.help-text {
  margin-top: 16px;
  color: #666;
  font-size: 14px;
}

.content {
  max-width: 900px;
  margin: 0 auto;
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 2px solid #eee;
}

.header h1 {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--dark);
}

.student-info {
  font-size: 14px;
  color: #666;
}

.student-info p {
  margin: 4px 0;
}

.intro {
  margin-bottom: 32px;
  line-height: 1.8;
  color: #333;
}

.tasks-section h2 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--dark);
}

.no-tasks {
  text-align: center;
  padding: 40px;
  color: #999;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  display: flex;
  gap: 16px;
  padding: 20px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  transition: all 0.2s;
}

.task-item:hover {
  border-color: var(--coral);
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.1);
}

.task-checkbox {
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
}

.checkbox {
  width: 24px;
  height: 24px;
  cursor: pointer;
  accent-color: var(--coral);
}

.task-content {
  flex: 1;
}

.task-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.task-school {
  font-size: 18px;
  font-weight: 600;
  color: var(--dark);
  margin: 0;
}

.task-status-badge {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-submitted {
  background-color: #4caf50;
  color: white;
}

.status-accepted {
  background-color: #2196f3;
  color: white;
}

.status-invited {
  background-color: #ff9800;
  color: white;
}

.status-not_contacted {
  background-color: #f44336;
  color: white;
}

.task-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  gap: 8px;
  font-size: 14px;
}

.info-label {
  font-weight: 600;
  color: #666;
  min-width: 80px;
}

.info-value {
  color: #333;
}

.info-link {
  color: var(--coral);
  text-decoration: none;
  word-break: break-all;
}

.info-link:hover {
  text-decoration: underline;
}

.footer {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #eee;
}

.note {
  font-size: 13px;
  color: #666;
  font-style: italic;
}

.completion-section {
  margin-top: 24px;
  text-align: center;
}

.complete-btn {
  background: #4caf50;
  color: white;
  border: none;
  padding: 14px 32px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.complete-btn:hover {
  background: #45a049;
}

.thank-you-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.thank-you-content {
  background: white;
  padding: 60px 40px;
  border-radius: 16px;
  text-align: center;
  max-width: 500px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.thank-you-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #4caf50;
  color: white;
  font-size: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
  font-weight: bold;
}

.thank-you-content h1 {
  font-size: 32px;
  color: var(--dark);
  margin-bottom: 16px;
}

.thank-you-message {
  font-size: 18px;
  color: #666;
  margin-bottom: 16px;
}

.completion-time {
  font-size: 16px;
  color: #333;
  font-weight: 600;
  margin-bottom: 24px;
}

.thank-you-note {
  font-size: 14px;
  color: #999;
  font-style: italic;
}

.status-pending {
  background-color: #ff9800;
  color: white;
}
</style>

