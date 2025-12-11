<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  searchResults?: SearchResult[]
  sopReferences?: SOPReference[]
}

interface SearchResult {
  id: string
  type: 'professor' | 'school'
  name: string
  details: string
  relevance: number
  metadata?: {
    university?: string
    department?: string
    researchAreas?: string[]
    email?: string
    website?: string
  }
}

interface SOPReference {
  id: string
  title: string
  excerpt: string
  relevance: number
  link?: string
}

const router = useRouter()
const auth = useAuth()

const messages = ref<Message[]>([])
const inputText = ref('')
const isLoading = ref(false)
const typingMessages = ref<Record<string, string>>({}) // Store typing content for each message
const messagesContainer = ref<HTMLElement | null>(null)

// Mock data for demonstration
const mockProfessors: SearchResult[] = [
  {
    id: '1',
    type: 'professor',
    name: 'Dr. Jane Smith',
    details: 'Expert in Machine Learning and Computer Vision',
    relevance: 0.95,
    metadata: {
      university: 'MIT',
      department: 'Computer Science',
      researchAreas: ['Machine Learning', 'Computer Vision', 'Deep Learning'],
      email: 'jane.smith@mit.edu',
      website: 'https://example.com'
    }
  },
  {
    id: '2',
    type: 'professor',
    name: 'Dr. John Doe',
    details: 'Specializes in Natural Language Processing',
    relevance: 0.88,
    metadata: {
      university: 'Stanford',
      department: 'Computer Science',
      researchAreas: ['NLP', 'AI', 'Computational Linguistics'],
      email: 'john.doe@stanford.edu'
    }
  }
]

const mockSchools: SearchResult[] = [
  {
    id: '3',
    type: 'school',
    name: 'MIT Computer Science',
    details: 'Top-ranked program with strong ML research',
    relevance: 0.92,
    metadata: {
      university: 'MIT',
      department: 'Computer Science'
    }
  },
  {
    id: '4',
    type: 'school',
    name: 'Stanford CS PhD Program',
    details: 'Excellent program in AI and ML',
    relevance: 0.90,
    metadata: {
      university: 'Stanford',
      department: 'Computer Science'
    }
  }
]

const mockSOPReferences: SOPReference[] = [
  {
    id: '1',
    title: 'Research Experience in ML',
    excerpt: 'During my undergraduate research, I worked on developing novel deep learning architectures...',
    relevance: 0.85,
    link: '/sop'
  },
  {
    id: '2',
    title: 'Why This Program',
    excerpt: 'I am particularly interested in the research conducted by Dr. Smith in computer vision...',
    relevance: 0.78,
    link: '/sop'
  }
]

// Typing effect function
const typeMessage = (messageId: string, fullText: string, callback?: () => void) => {
  typingMessages.value[messageId] = ''
  let currentIndex = 0
  
  const typeInterval = setInterval(() => {
    if (currentIndex < fullText.length) {
      typingMessages.value[messageId] = fullText.substring(0, currentIndex + 1)
      currentIndex++
      // Auto scroll to bottom
      scrollToBottom()
    } else {
      clearInterval(typeInterval)
      if (callback) callback()
    }
  }, 20) // 20ms per character for smooth typing effect
}

const scrollToBottom = () => {
  setTimeout(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }, 100)
}

const sendMessage = async () => {
  if (!inputText.value.trim() || isLoading.value) return
  
  const userMessage: Message = {
    id: Date.now().toString(),
    role: 'user',
    content: inputText.value,
    timestamp: new Date()
  }
  
  messages.value.push(userMessage)
  const currentInput = inputText.value
  inputText.value = ''
  isLoading.value = true
  
  // Scroll to show user message
  scrollToBottom()
  
  // Simulate AI processing
  setTimeout(() => {
    // Mock response based on input
    let response = ''
    let results: SearchResult[] = []
    let references: SOPReference[] = []
    
    const lowerInput = currentInput.toLowerCase()
    
    if (lowerInput.includes('professor') || lowerInput.includes('researcher') || lowerInput.includes('advisor')) {
      response = 'I found some professors that match your interests:'
      results = mockProfessors
      references = mockSOPReferences.filter(ref => ref.title.includes('Research'))
    } else if (lowerInput.includes('school') || lowerInput.includes('program') || lowerInput.includes('university')) {
      response = 'Here are some programs that might interest you:'
      results = mockSchools
      references = mockSOPReferences.filter(ref => ref.title.includes('Program'))
    } else {
      response = 'I found some relevant results for your query:'
      results = [...mockProfessors.slice(0, 1), ...mockSchools.slice(0, 1)]
      references = mockSOPReferences
    }
    
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      searchResults: results.length > 0 ? results : undefined,
      sopReferences: references.length > 0 ? references : undefined
    }
    
    messages.value.push(assistantMessage)
    isLoading.value = false
    
    // Start typing effect
    typeMessage(assistantMessageId, response, () => {
      // Typing complete, ensure full content is displayed
      typingMessages.value[assistantMessageId] = response
    })
  }, 1000)
}

const createApplicationFromResult = (result: SearchResult) => {
  if (result.type === 'school') {
    router.push({
      path: '/home',
      query: { 
        action: 'add',
        school: result.name,
        university: result.metadata?.university || ''
      }
    })
  }
}

const viewSOPReference = (sop: SOPReference) => {
  if (sop.link) {
    router.push(sop.link)
  }
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

onMounted(() => {
  if (!auth.user) {
    router.push('/')
    return
  }
  
  // Add welcome message with typing effect
  const welcomeMessage: Message = {
    id: '0',
    role: 'assistant',
    content: 'Hello! I can help you search for professors, programs, and find relevant sections in your SOP. What would you like to search for?',
    timestamp: new Date()
  }
  messages.value.push(welcomeMessage)
  // Start typing effect for welcome message
  setTimeout(() => {
    typeMessage('0', welcomeMessage.content)
  }, 300)
})
</script>

<template>
  <div class="layout">
    <main class="main-content">
      <div class="chat-container">
        <div class="chat-header">
          <h1>AI Assisted Search</h1>
          <p class="subtitle">Search for professors, programs, and get AI-powered recommendations</p>
        </div>
        
        <div class="messages-container" ref="messagesContainer">
          <div 
            v-for="message in messages" 
            :key="message.id"
            :class="['message', message.role]"
          >
            <div class="message-avatar">
              <span v-if="message.role === 'user'">👤</span>
              <span v-else>🤖</span>
            </div>
            <div class="message-content">
              <div class="message-text">
                <span v-if="message.role === 'assistant' && typingMessages[message.id] !== undefined">
                  {{ typingMessages[message.id] || '' }}
                  <span v-if="typingMessages[message.id] !== message.content" class="typing-cursor">|</span>
                </span>
                <span v-else>{{ message.content }}</span>
              </div>
              
              <!-- Search Results in Message -->
              <div v-if="message.searchResults && message.searchResults.length > 0" class="message-results">
                <h3 class="results-title-inline">Search Results</h3>
                <div class="results-grid-inline">
                  <div 
                    v-for="result in message.searchResults" 
                    :key="result.id"
                    class="result-card-inline"
                    @click="createApplicationFromResult(result)"
                  >
                    <div class="result-header">
                      <span class="result-type">{{ result.type === 'professor' ? '👨‍🏫' : '🏫' }}</span>
                      <span class="result-relevance">{{ Math.round(result.relevance * 100) }}% match</span>
                    </div>
                    <h3 class="result-name">{{ result.name }}</h3>
                    <p class="result-details">{{ result.details }}</p>
                    <div v-if="result.metadata" class="result-metadata">
                      <div v-if="result.metadata.university" class="metadata-item">
                        <strong>University:</strong> {{ result.metadata.university }}
                      </div>
                      <div v-if="result.metadata.department" class="metadata-item">
                        <strong>Department:</strong> {{ result.metadata.department }}
                      </div>
                      <div v-if="result.metadata.researchAreas" class="metadata-item">
                        <strong>Research Areas:</strong> {{ result.metadata.researchAreas.join(', ') }}
                      </div>
                      <div v-if="result.metadata.email" class="metadata-item">
                        <strong>Email:</strong> {{ result.metadata.email }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- SOP References in Message -->
              <div v-if="message.sopReferences && message.sopReferences.length > 0" class="message-sop">
                <h3 class="results-title-inline">Relevant SOP Sections</h3>
                <div class="sop-list-inline">
                  <div 
                    v-for="sop in message.sopReferences" 
                    :key="sop.id"
                    class="sop-card-inline"
                    @click="viewSOPReference(sop)"
                  >
                    <div class="sop-header">
                      <h4 class="sop-title">{{ sop.title }}</h4>
                      <span class="sop-relevance">{{ Math.round(sop.relevance * 100) }}% relevant</span>
                    </div>
                    <p class="sop-excerpt">{{ sop.excerpt }}</p>
                    <button class="sop-link-btn">View in SOP →</button>
                  </div>
                </div>
              </div>
              
              <div class="message-time">{{ formatTime(message.timestamp) }}</div>
            </div>
          </div>
          
          <div v-if="isLoading" class="message assistant">
            <div class="message-avatar">🤖</div>
            <div class="message-content">
              <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="input-container">
          <input
            v-model="inputText"
            @keyup.enter="sendMessage"
            type="text"
            placeholder="Ask me anything about professors, programs, or your SOP..."
            class="chat-input"
            :disabled="isLoading"
          />
          <button 
            @click="sendMessage"
            class="send-button"
            :disabled="isLoading || !inputText.trim()"
          >
            <span v-if="!isLoading">Send</span>
            <span v-else>Sending...</span>
          </button>
        </div>
      </div>
    </main>
    <Sidebar />
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  padding: 24px;
}

.chat-header {
  margin-bottom: 24px;
}

.chat-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin-bottom: 8px;
}

.subtitle {
  color: #666;
  font-size: 14px;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0;
  margin-bottom: 16px;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  animation: slideIn 0.3s ease-out;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.message.user .message-avatar {
  background: #ff6b6b;
}

.message-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.message.user .message-content {
  align-items: flex-end;
}

.message-text {
  background: white;
  padding: 12px 16px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  word-wrap: break-word;
  margin-bottom: 12px;
  display: inline-block;
  max-width: 100%;
  min-width: fit-content;
}

.message.user .message-text {
  background: #ff6b6b;
  color: white;
}

.typing-cursor {
  display: inline-block;
  animation: blink 1s infinite;
  margin-left: 2px;
  color: inherit;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

.message-results,
.message-sop {
  margin-top: 16px;
}

.results-title-inline {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.results-grid-inline {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.result-card-inline {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.result-card-inline:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.result-type {
  font-size: 20px;
}

.result-relevance {
  font-size: 11px;
  color: #4caf50;
  font-weight: 600;
  background: rgba(76, 175, 80, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
}

.result-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 6px;
}

.result-details {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.result-metadata {
  font-size: 11px;
  color: #999;
}

.metadata-item {
  margin-bottom: 3px;
}

.sop-list-inline {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.sop-card-inline {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.sop-card-inline:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.sop-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.sop-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.sop-relevance {
  font-size: 11px;
  color: #4caf50;
  font-weight: 600;
  background: rgba(76, 175, 80, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
}

.sop-excerpt {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  line-height: 1.4;
}

.sop-link-btn {
  background: transparent;
  border: none;
  color: #ff6b6b;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
}

.sop-link-btn:hover {
  text-decoration: underline;
}

.message-time {
  font-size: 11px;
  color: #999;
  margin-top: 8px;
  padding: 0 4px;
}

.loading-dots {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}


.input-container {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
}

.chat-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.chat-input:focus {
  border-color: #ff6b6b;
}

.send-button {
  padding: 12px 24px;
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.send-button:hover:not(:disabled) {
  background: #ff5252;
}

.send-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
