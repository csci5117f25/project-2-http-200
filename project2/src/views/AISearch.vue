<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'
import { 
  loadSOPData, 
  preprocessQuery,
  extractNameCandidate,
  multiPathRecallProfessors,
  multiPathRecallSOPs,
  hasPersonName
} from '../utils/aiSearch'
import { searchWithAI } from '../services/openai'
import { useSOP } from '../stores/sop'
import Card from '../components/ui/card.vue'
import Button from '../components/ui/button.vue'
import Input from '../components/ui/input.vue'

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
  field?: string
  institution?: string
}

const router = useRouter()
const auth = useAuth()
const sopStore = useSOP()

// Get user initial for avatar
const getUserInitial = () => {
  return auth.user?.email?.[0]?.toUpperCase() || 'U'
}

const messages = ref<Message[]>([])
const inputText = ref('')
const isLoading = ref(false)
const typingMessages = ref<Record<string, string>>({}) // Store typing content for each message
const messagesContainer = ref<HTMLElement | null>(null)
const isInitialized = ref(false) // Flag to prevent saving during initialization

// Cache for SOP data
let sopDataCache: any[] = []

// Get localStorage key for current user
const getStorageKey = (): string => {
  const userId = auth.user?.uid || 'anonymous'
  return `ai_search_messages_${userId}`
}

// Save messages to localStorage
const saveMessages = () => {
  if (!auth.user || !isInitialized.value) {
    console.log('Skipping save - user:', !!auth.user, 'initialized:', isInitialized.value)
    return // Don't save during initialization
  }
  
  try {
    // Create a snapshot of current messages to avoid reactivity issues
    const currentMessages = [...messages.value]
    const messagesToSave = currentMessages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp.toISOString() // Convert Date to string for JSON serialization
    }))
    console.log('Saving messages to localStorage:', {
      count: messagesToSave.length,
      userMessages: messagesToSave.filter(m => m.role === 'user').length,
      keys: messagesToSave.map(m => ({ id: m.id, role: m.role }))
    })
    localStorage.setItem(getStorageKey(), JSON.stringify(messagesToSave))
  } catch (error) {
    console.error('Failed to save messages to localStorage:', error)
  }
}

// Load messages from localStorage
const loadMessages = (): Message[] => {
  if (!auth.user) {
    console.log('Cannot load messages - no user')
    return []
  }
  
  try {
    const storageKey = getStorageKey()
    const saved = localStorage.getItem(storageKey)
    console.log('Loading messages from localStorage:', { storageKey, hasData: !!saved })
    
    if (saved) {
      const parsed = JSON.parse(saved)
      const loaded = parsed.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp) // Convert string back to Date
      }))
      console.log('Loaded messages:', {
        count: loaded.length,
        userMessages: loaded.filter((m: any) => m.role === 'user').length,
        allMessages: loaded.map((m: any) => ({ id: m.id, role: m.role, content: m.content.substring(0, 30) }))
      })
      return loaded
    }
  } catch (error) {
    console.error('Failed to load messages from localStorage:', error)
  }
  return []
}

// Watch messages and save to localStorage when they change
let isSaving = false // Prevent recursive saves
let isInitializing = true // Track initialization state

watch(messages, (newMessages, oldMessages) => {
  // Debug: log message changes
  console.log('Messages changed:', {
    oldLength: oldMessages?.length || 0,
    newLength: newMessages.length,
    lastMessage: newMessages[newMessages.length - 1],
    userMessages: newMessages.filter(m => m.role === 'user').length,
    allMessages: newMessages.map(m => ({ id: m.id, role: m.role, content: m.content.substring(0, 30) })),
    isInitialized: isInitialized.value,
    isInitializing: isInitializing,
    isSaving: isSaving
  })
  
  // Only save if:
  // 1. Initialized
  // 2. Not currently initializing
  // 3. Messages exist
  // 4. This is not the initial load (oldMessages exists)
  // 5. Not already saving
  // 6. New messages count is greater than or equal to old (prevent saving empty/decreased state)
  // 7. Ensure we have user messages if oldMessages had user messages (prevent losing user messages)
  const hadUserMessages = oldMessages?.some(m => m.role === 'user') || false
  const hasUserMessages = newMessages.some(m => m.role === 'user')
  
  const shouldSave = isInitialized.value && 
                     !isInitializing && 
                     newMessages.length > 0 && 
                     oldMessages !== undefined && 
                     oldMessages.length > 0 &&
                     newMessages.length >= oldMessages.length &&
                     (!hadUserMessages || hasUserMessages) && // Don't save if we lost user messages
                     !isSaving
  
  if (shouldSave) {
    isSaving = true
    try {
      console.log('Saving messages...')
      saveMessages()
    } finally {
      // Use nextTick to ensure save completes before allowing next save
      nextTick(() => {
        isSaving = false
      })
    }
  } else {
    console.log('Skipping save:', {
      isInitialized: isInitialized.value,
      isInitializing,
      newLength: newMessages.length,
      oldLength: oldMessages?.length || 0,
      hadUserMessages,
      hasUserMessages,
      isSaving,
      reason: !isInitialized.value ? 'not initialized' :
              isInitializing ? 'initializing' :
              newMessages.length === 0 ? 'no messages' :
              oldMessages === undefined ? 'initial load' :
              oldMessages.length === 0 ? 'old empty' :
              newMessages.length < oldMessages.length ? 'messages decreased' :
              (hadUserMessages && !hasUserMessages) ? 'lost user messages' :
              isSaving ? 'already saving' : 'unknown'
    })
  }
}, { deep: true })

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

const sendMessage = async (isRetry: boolean = false, retryQuery?: string) => {
  const query = retryQuery || inputText.value.trim()
  
  if (!query) return
  
  // Don't allow new messages while loading (unless it's a retry)
  if (!isRetry && isLoading.value) return
  
  // Check for API key
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    alert('OpenAI API key is not configured. Please set VITE_OPENAI_API_KEY in your .env file.')
    return
  }
  
  // Add user message first (before any async operations)
  let processingQuery = query
  if (!isRetry) {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date()
    }
    // Use push to ensure reactivity (Vue tracks array mutations)
    messages.value.push(userMessage)
    inputText.value = ''
    
    // Force save immediately to prevent loss
    if (isInitialized.value) {
      saveMessages()
    }
    
    // Wait for Vue to update DOM before scrolling
    await nextTick()
    scrollToBottom()
  }
  
  isLoading.value = true
  
  try {
    // 1. Query preprocessing with acronym/alias expansion
    const { raw: rawQuery, retrieval: retrievalQuery, expanded: expandedQueries } = preprocessQuery(processingQuery)
    const nameCandidate = extractNameCandidate(processingQuery)
    
    // 2. Multi-path recall with expanded queries
    const limit = isRetry ? 200 : 50 // Increase limit on retry
    const relevantProfessors = multiPathRecallProfessors(
      rawQuery,
      retrievalQuery,
      nameCandidate,
      limit,
      isRetry,
      expandedQueries
    )
    const relevantSOPs = multiPathRecallSOPs(
      rawQuery,
      retrievalQuery,
      sopDataCache,
      isRetry ? 50 : 20,
      expandedQueries
    )
    
    // 3. Get user's own SOP content if available
    const userSOP = sopStore.content || undefined
    
    // 4. Call search service with filtered context
    const result = await searchWithAI(
      rawQuery, // Use raw query to preserve original intent
      relevantProfessors,
      relevantSOPs,
      userSOP
    )
    
    // 5. Check if retry is needed
    const needsRetry = !isRetry && (
      (relevantProfessors.length < 3 && hasPersonName(processingQuery)) ||
      (result.professors.length === 0 && result.schools.length === 0) ||
      result.answer.toLowerCase().includes("don't have direct information") ||
      result.answer.toLowerCase().includes("unfortunately") ||
      result.answer.toLowerCase().includes("i don't have")
    )
    
    if (needsRetry) {
      isLoading.value = false
      // Retry with expanded limits, pass the original query
      return sendMessage(true, rawQuery)
    }
    
    // 5.5. Supplement search results if too few professors returned
    // If search returned very few professors (especially for school queries), add more from relevantProfessors
    const queryLower = rawQuery.toLowerCase()
    const isSchoolQuery = queryLower.includes('university') || queryLower.includes('college') || 
                         queryLower.includes('umn') || queryLower.includes('minnesota') ||
                         relevantProfessors.some(p => queryLower.includes(p.affiliation.toLowerCase()))
    
    if (result.professors.length < 3 && isSchoolQuery && relevantProfessors.length > result.professors.length) {
      // Find professors that match the school query but weren't returned by search
      const searchProfessorKeys = new Set(result.professors.map(p => `${p.name}|${p.affiliation}`))
      const additionalProfessors = relevantProfessors
        .filter(prof => {
          const key = `${prof.name}|${prof.affiliation}`
          return !searchProfessorKeys.has(key)
        })
        .slice(0, Math.min(5 - result.professors.length, 10)) // Add up to 5 total, or 10 more
        .map(prof => ({
          name: prof.name,
          affiliation: prof.affiliation,
          relevance: 0.75, // Slightly lower relevance for supplemented results
          reason: `Affiliated with ${prof.affiliation}`,
          homepage: prof.homepage,
          scholarid: prof.scholarid
        }))
      
      // Add supplemented professors to result
      result.professors.push(...additionalProfessors)
    }
    
    // 4. Convert search results to our Message format
    const searchResults: SearchResult[] = result.professors.map(p => {
      // Find full professor data
      const fullProf = relevantProfessors.find(prof => 
        prof.name === p.name && prof.affiliation === p.affiliation
      )
      
      return {
        id: p.name + p.affiliation,
        type: 'professor' as const,
        name: p.name,
        details: p.reason || `${p.affiliation}`,
        relevance: p.relevance,
        metadata: {
          university: p.affiliation,
          email: undefined,
          website: p.homepage || fullProf?.homepage,
          researchAreas: undefined
        }
      }
    })
    
    // Add schools as search results
    const schoolResults: SearchResult[] = result.schools.map(s => ({
      id: s.name,
      type: 'school' as const,
      name: s.name,
      details: s.reason || s.name,
      relevance: s.relevance,
      metadata: {
        university: s.name
      }
    }))
    
    const allSearchResults = [...searchResults, ...schoolResults]
    
    const sopReferences: SOPReference[] = result.sopReferences.map(s => ({
      id: s.title,
      title: s.title,
      excerpt: s.excerpt,
      relevance: s.relevance,
      link: '/sop',
      field: s.field,
      institution: s.institution
    }))
    
    // 5. Create assistant message
    const assistantMessageId = `assistant-${Date.now()}`
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: result.answer,
      timestamp: new Date(),
      searchResults: allSearchResults.length > 0 ? allSearchResults : undefined,
      sopReferences: sopReferences.length > 0 ? sopReferences : undefined
    }
    
    messages.value.push(assistantMessage)
    isLoading.value = false
    
    // 6. Start typing effect
    typeMessage(assistantMessageId, result.answer, () => {
      typingMessages.value[assistantMessageId] = result.answer
    })
  } catch (error: any) {
    console.error('Search error:', error)
    isLoading.value = false
    
    const errorMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: error.message?.includes('API key') 
        ? 'Please configure your OpenAI API key in the .env file (VITE_OPENAI_API_KEY).'
        : 'Sorry, I encountered an error processing your query. Please try again.',
      timestamp: new Date()
    }
    
    messages.value.push(errorMessage)
    typeMessage(errorMessage.id, errorMessage.content)
  }
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
  // Navigate to SOP page with query parameters to find and display the specific SOP
  router.push({
    path: '/sop',
    query: {
      name: sop.title,
      field: sop.field || '',
      institution: sop.institution || ''
    }
  })
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

onMounted(async () => {
  if (!auth.user) {
    router.push('/')
    return
  }
  
  // Load SOP data in background
  try {
    sopDataCache = await loadSOPData()
  } catch (error) {
    console.error('Failed to load SOP data:', error)
  }
  
  // Load saved messages from localStorage
  const savedMessages = loadMessages()
  
  // Set isInitializing flag BEFORE setting messages to prevent watch from saving
  isInitializing = true
  
  // Set messages before enabling watch to prevent save during load
  if (savedMessages.length > 0) {
    // Restore saved messages - use direct assignment to avoid triggering watch prematurely
    messages.value = savedMessages
    // Restore typing effects for all assistant messages (show full content immediately)
    savedMessages.forEach(msg => {
      if (msg.role === 'assistant' && msg.content) {
        typingMessages.value[msg.id] = msg.content
      }
    })
  } else {
    // Add welcome message with typing effect if no saved messages
    const welcomeMessage: Message = {
      id: '0',
      role: 'assistant',
      content: 'Hello! I can help you search for professors, applications, and find relevant sections in your SOP. What would you like to search for?',
      timestamp: new Date()
    }
    messages.value = [welcomeMessage]
    // Start typing effect for welcome message
    setTimeout(() => {
      typeMessage('0', welcomeMessage.content)
    }, 300)
  }
  
  // Wait for Vue to update DOM, then mark as initialized
  await nextTick()
  scrollToBottom()
  
  // Wait a bit more to ensure DOM is fully updated
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Mark initialization as complete AFTER messages are set and DOM is updated
  isInitializing = false
  isInitialized.value = true
})
</script>

<template>
  <div class="flex h-screen bg-background overflow-hidden">
    <Sidebar />
    <main class="flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out">
      <div class="flex-1 overflow-y-auto min-h-0" ref="messagesContainer">
        <div class="max-w-4xl lg:max-w-6xl mx-auto w-full p-4 md:p-6">
          <div class="mb-6">
            <h1 class="text-3xl font-bold mb-2">Intelligent Search</h1>
            <p class="text-muted-foreground">Search for professors, applications, and get personalized recommendations</p>
          </div>
          
          <div class="space-y-4">
            <div
              v-for="message in messages" 
              :key="`${message.id}-${message.role}`"
              :class="[
                'p-4 rounded-lg border shadow-sm flex gap-3',
                message.role === 'user' 
                  ? 'bg-primary/10 ml-auto max-w-[80%] text-foreground border-primary/20 flex-row-reverse' 
                  : 'bg-card max-w-[80%] mr-auto text-card-foreground'
              ]"
            >
            <!-- User avatar (right side) -->
            <div v-if="message.role === 'user'" class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {{ getUserInitial() }}
            </div>
            <!-- Assistant avatar (left side) -->
            <div v-else class="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <span class="text-lg">🤖</span>
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm mb-2">
                  <template v-if="message.role === 'assistant' && typingMessages[message.id] !== undefined">
                    <span>{{ typingMessages[message.id] || '' }}</span>
                    <span v-if="typingMessages[message.id] !== message.content" class="animate-pulse">|</span>
                  </template>
                  <template v-else>
                    <span>{{ message.content }}</span>
                  </template>
                </div>
                
                <!-- Search Results -->
                <div v-if="message.searchResults && message.searchResults.length > 0" class="mt-4 space-y-3">
                  <h3 class="text-sm font-semibold">Search Results</h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Card
                      v-for="result in message.searchResults" 
                      :key="result.id"
                      class="p-3 hover:bg-muted cursor-pointer transition-colors"
                      @click="createApplicationFromResult(result)"
                    >
                      <div class="flex items-start mb-2">
                        <span class="text-lg">{{ result.type === 'professor' ? '👨‍🏫' : '🏫' }}</span>
                      </div>
                      <h4 class="font-semibold mb-1">{{ result.name }}</h4>
                      <p class="text-sm text-muted-foreground mb-2">{{ result.details }}</p>
                      <div v-if="result.metadata" class="space-y-1 text-xs text-muted-foreground">
                        <div v-if="result.metadata.university">
                          <strong>University:</strong> {{ result.metadata.university }}
                        </div>
                        <div v-if="result.metadata.department">
                          <strong>Department:</strong> {{ result.metadata.department }}
                        </div>
                        <div v-if="result.metadata.researchAreas">
                          <strong>Research Areas:</strong> {{ result.metadata.researchAreas.join(', ') }}
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
                
                <!-- SOP References -->
                <div v-if="message.sopReferences && message.sopReferences.length > 0" class="mt-4 space-y-3">
                  <h3 class="text-sm font-semibold">SOP Sections</h3>
                  <div class="space-y-2">
                    <Card
                      v-for="sop in message.sopReferences" 
                      :key="sop.id"
                      class="p-3 hover:bg-muted cursor-pointer transition-colors"
                      @click="viewSOPReference(sop)"
                    >
                      <div class="flex items-start mb-2">
                        <h4 class="font-semibold">{{ sop.title }}</h4>
                      </div>
                      <p class="text-sm text-muted-foreground mb-2">{{ sop.excerpt }}</p>
                      <Button variant="ghost" size="sm" class="h-7 text-xs">
                        View in SOP →
                      </Button>
                    </Card>
                  </div>
                </div>
                
                <div class="text-xs text-muted-foreground mt-2">{{ formatTime(message.timestamp) }}</div>
              </div>
            </div>
            
            <Card v-if="isLoading" class="p-4 bg-card max-w-[80%] mr-auto">
              <div class="flex gap-3">
                <div class="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <span class="text-lg">🤖</span>
                </div>
                <div class="flex gap-1 items-center">
                  <span class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></span>
                  <span class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
                  <span class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      
      <div class="flex-shrink-0 pt-4 pb-4 px-6 w-full sticky bottom-0 bg-background z-10 border-t border-border">
        <div class="max-w-6xl mx-auto w-full flex gap-2">
          <Input
            :value="inputText"
            @update:value="(val: string) => inputText = val"
            @keyup.enter="() => sendMessage()"
            placeholder="Ask me anything about professors, applications, or your SOP..."
            :disabled="isLoading"
            class="flex-1"
          />
          <Button 
            @click="() => sendMessage()"
            :disabled="isLoading || !inputText.trim()"
          >
            <span v-if="!isLoading">Send</span>
            <span v-else>Sending...</span>
          </Button>
        </div>
      </div>
    </main>
  </div>
</template>

