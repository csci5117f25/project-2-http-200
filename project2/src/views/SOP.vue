<script setup lang="ts">
<<<<<<< HEAD
import { useSOP } from '../stores/sop'
import Sidebar from '../components/Sidebar.vue'

const sop = useSOP()
=======
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loadSOPData, type SOPData } from '../utils/aiSearch'
import { useAuth } from '../stores/auth'
import { useThemeStore } from '../stores/theme'
import Sidebar from '../components/Sidebar.vue'
import Card from '../components/ui/card.vue'
import Input from '../components/ui/input.vue'
import Button from '../components/ui/button.vue'
import Badge from '../components/ui/badge.vue'
// @ts-ignore - md-editor-v3 type definitions issue
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const themeStore = useThemeStore()

// SOP browsing state
const allSOPs = ref<SOPData[]>([])
const searchQuery = ref('')
const selectedSOP = ref<SOPData | null>(null)
const showSOPDetail = ref(false)
const loadingSOPs = ref(false)
const sopListContainer = ref<HTMLElement | null>(null)
const isInitialized = ref(false) // Flag to prevent saving during initialization
const pdfLoadFailed = ref(false) // Track if PDF failed to load
const editorContent = ref('') // Markdown editor content

// Get localStorage key for current user (page state)
const getStorageKey = (): string => {
  const userId = auth.user?.uid || 'anonymous'
  return `sop_page_state_${userId}`
}

// Get localStorage key for SOP content
const getSOPContentStorageKey = (): string => {
  const userId = auth.user?.uid || 'anonymous'
  return `sop_editor_content_${userId}`
}

// Save state to localStorage
const saveState = (forceScrollPosition?: number) => {
  if (!auth.user || (!isInitialized.value && forceScrollPosition === undefined)) {
    return // Don't save during initialization unless forced
  }
  
  try {
    const scrollPosition = forceScrollPosition !== undefined 
      ? forceScrollPosition 
      : (sopListContainer.value?.scrollTop || 0)
    const state = {
      searchQuery: searchQuery.value,
      scrollPosition: scrollPosition,
      selectedSOPId: selectedSOP.value ? `${selectedSOP.value.name}-${selectedSOP.value.institution}` : null
    }
    localStorage.setItem(getStorageKey(), JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save SOP page state to localStorage:', error)
  }
}

// Load state from localStorage
const loadState = () => {
  if (!auth.user) {
    return null
  }
  
  try {
    const storageKey = getStorageKey()
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.error('Failed to load SOP page state from localStorage:', error)
  }
  return null
}

// Load all SOPs from dataset
const loadAllSOPs = async () => {
  loadingSOPs.value = true
  try {
    allSOPs.value = await loadSOPData()
  } catch (error) {
    console.error('Failed to load SOPs:', error)
  } finally {
    loadingSOPs.value = false
  }
}

// Filtered SOPs based on search
const filteredSOPs = computed(() => {
  if (!searchQuery.value.trim()) return allSOPs.value
  
  const query = searchQuery.value.toLowerCase()
  return allSOPs.value.filter(sop => 
    sop.name.toLowerCase().includes(query) ||
    sop.field.toLowerCase().includes(query) ||
    sop.institution.toLowerCase().includes(query) ||
    sop.content.toLowerCase().includes(query)
  )
})

// Save editor content to localStorage
const saveEditorContentToLocalStorage = () => {
  if (!auth.user || !isInitialized.value) {
    return // Don't save during initialization
  }
  
  try {
    localStorage.setItem(getSOPContentStorageKey(), editorContent.value)
  } catch (error) {
    console.error('Failed to save SOP content to localStorage:', error)
  }
}

// Load editor content from localStorage
const loadEditorContentFromLocalStorage = () => {
  if (!auth.user) {
    console.log('Cannot load SOP content - no user')
    return ''
  }
  
  try {
    const saved = localStorage.getItem(getSOPContentStorageKey())
    if (saved !== null) {
      return saved
    }
  } catch (error) {
    console.error('Failed to load SOP content from localStorage:', error)
  }
  return ''
}

// Export SOP content as MD file
const exportAsMarkdown = () => {
  if (!editorContent.value.trim()) {
    alert('No content to export')
    return
  }
  
  const blob = new Blob([editorContent.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  
  // Generate filename with current date
  const date = new Date()
  const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
  link.download = `SOP_${dateStr}.md`
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
}

// Editor theme based on app theme
const editorTheme = computed(() => {
  return themeStore.theme === 'dark' ? 'dark' : 'light'
})

// Select a reference SOP to view
const selectReferenceSOP = (sop: SOPData) => {
  // Save scroll position before switching to detail view
  if (sopListContainer.value) {
    const scrollPosition = sopListContainer.value.scrollTop
    saveState(scrollPosition) // Force save with current scroll position
  }
  
  // Reset PDF load failed state when selecting new SOP
  pdfLoadFailed.value = false
  selectedSOP.value = sop
  showSOPDetail.value = true
}

// Handle PDF load error
const handlePDFError = () => {
  pdfLoadFailed.value = true
}

// Return to list view
const backToList = async () => {
  // Load saved scroll position before switching views
  const savedState = loadState()
  const scrollPosition = savedState?.scrollPosition || 0
  
  showSOPDetail.value = false
  selectedSOP.value = null
  
  // Wait for DOM to update and list view to render
  await nextTick()
  
  // Use multiple strategies to ensure scroll position is restored
  const restoreScroll = () => {
    if (sopListContainer.value && sopListContainer.value.scrollHeight > 0) {
      sopListContainer.value.scrollTop = scrollPosition
      return true
    }
    return false
  }
  
  // Try immediately after nextTick
  if (restoreScroll()) return
  
  // Try after first animation frame
  requestAnimationFrame(() => {
    if (restoreScroll()) return
    
    // Try after second animation frame
    requestAnimationFrame(() => {
      if (restoreScroll()) return
      
      // Final fallback with timeout
      setTimeout(() => {
        restoreScroll()
      }, 300)
    })
  })
}

// Extract Google Drive file ID from URL
const extractGoogleDriveFileId = (url: string): string | null => {
  // Pattern 1: https://drive.google.com/file/d/FILE_ID/view
  const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (driveFileMatch && driveFileMatch[1]) {
    return driveFileMatch[1]
  }
  
  // Pattern 2: https://drive.google.com/open?id=FILE_ID
  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/)
  if (driveOpenMatch && driveOpenMatch[1]) {
    return driveOpenMatch[1]
  }
  
  // Pattern 3: https://docs.google.com/document/d/FILE_ID/edit
  const docsMatch = url.match(/docs\.google\.com\/[^/]+\/d\/([a-zA-Z0-9_-]+)/)
  if (docsMatch && docsMatch[1]) {
    return docsMatch[1]
  }
  
  return null
}

// Extract GitHub raw URL from GitHub blob URL
const convertGitHubUrl = (url: string): string => {
  // Pattern: https://github.com/user/repo/blob/branch/path/to/file.pdf
  const githubBlobMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/)
  if (githubBlobMatch) {
    const [, user, repo, branch, path] = githubBlobMatch
    // Convert to raw GitHub URL
    return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`
  }
  
  // Pattern: https://github.com/user/repo/raw/branch/path/to/file.pdf (already raw)
  const githubRawMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/raw\/([^/]+)\/(.+)/)
  if (githubRawMatch) {
    const [, user, repo, branch, path] = githubRawMatch
    return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`
  }
  
  // GitHub Pages URLs (like github.io) are already direct PDF links, return as-is
  if (url.includes('github.io') && url.endsWith('.pdf')) {
    return url
  }
  
  return url
}

// Extract Overleaf project ID and convert to PDF download URL
const convertOverleafUrl = (url: string): string => {
  // Pattern 1: https://www.overleaf.com/read/xxxxx
  const overleafReadMatch = url.match(/overleaf\.com\/read\/([a-zA-Z0-9_-]+)/)
  if (overleafReadMatch && overleafReadMatch[1]) {
    const projectId = overleafReadMatch[1]
    return `https://www.overleaf.com/project/${projectId}/download/pdf`
  }
  
  // Pattern 2: https://www.overleaf.com/project/xxxxx
  const overleafProjectMatch = url.match(/overleaf\.com\/project\/([a-zA-Z0-9_-]+)/)
  if (overleafProjectMatch && overleafProjectMatch[1]) {
    const projectId = overleafProjectMatch[1]
    return `https://www.overleaf.com/project/${projectId}/download/pdf`
  }
  
  return url
}

// Convert Google Drive link to embeddable preview URL
const convertGoogleDriveUrl = (url: string): string => {
  const fileId = extractGoogleDriveFileId(url)
  if (fileId) {
    // Use Google Drive preview URL - this shows PDF directly, not HTML viewer
    return `https://drive.google.com/file/d/${fileId}/preview`
  }
  return url
}

// Get direct URL for opening in new tab (preserves original platform)
const getDirectUrl = (url: string): string => {
  // For Google Drive, use view URL
  const fileId = extractGoogleDriveFileId(url)
  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/view`
  }
  
  // For GitHub blob URLs, convert to raw
  if (url.includes('github.com') && url.includes('/blob/')) {
    return convertGitHubUrl(url)
  }
  
  // For Overleaf, return original URL (user can view/download from there)
  if (url.includes('overleaf.com')) {
    return url
  }
  
  // For other URLs, return as-is
  return url
}

// Extract PDF URL from SOP data
const getPDFUrl = (sop: SOPData | null): string | null => {
  if (!sop) return null
  
  let pdfUrl: string | null = null
  
  // Priority 1: Use statementLink if it's a PDF or known platform link
  if (sop.statementLink) {
    const link = sop.statementLink.toLowerCase()
    if (
      link.includes('drive.google.com') || 
      link.includes('github.com') || 
      link.includes('overleaf.com') ||
      link.endsWith('.pdf') || 
      link.includes('pdf')
    ) {
      pdfUrl = sop.statementLink
    }
  }
  
  // Priority 2: Extract PDF link from content (markdown format)
  if (!pdfUrl && sop.content) {
    // Look for markdown links [text](url)
    const pdfLinkMatch = sop.content.match(/\[([^\]]+)\]\(([^)]+)\)/i)
    if (pdfLinkMatch && pdfLinkMatch[2]) {
      const link = pdfLinkMatch[2].toLowerCase()
      if (
        link.includes('drive.google.com') || 
        link.includes('github.com') || 
        link.includes('overleaf.com') ||
        link.includes('.pdf')
      ) {
        pdfUrl = pdfLinkMatch[2]
      }
    }
    
    // Look for direct PDF URLs in content
    if (!pdfUrl) {
      const directPdfMatch = sop.content.match(/(https?:\/\/[^\s]+)/i)
      if (directPdfMatch && directPdfMatch[1]) {
        const link = directPdfMatch[1].toLowerCase()
        if (
          link.includes('drive.google.com') || 
          link.includes('github.com') || 
          link.includes('overleaf.com') ||
          link.includes('.pdf')
        ) {
          pdfUrl = directPdfMatch[1]
        }
      }
    }
  }
  
  // Priority 3: Use statementLink even if not explicitly PDF (might be a redirect)
  if (!pdfUrl && sop.statementLink) {
    pdfUrl = sop.statementLink
  }
  
  if (!pdfUrl) return null
  
  // Convert URLs based on platform
  const urlLower = pdfUrl.toLowerCase()
  
  // Google Drive: convert to preview URL
  if (urlLower.includes('drive.google.com')) {
    return convertGoogleDriveUrl(pdfUrl)
  }
  
  // GitHub: convert blob URLs to raw URLs for direct PDF access
  if (urlLower.includes('github.com')) {
    return convertGitHubUrl(pdfUrl)
  }
  
  // Overleaf: convert to PDF download URL
  if (urlLower.includes('overleaf.com')) {
    return convertOverleafUrl(pdfUrl)
  }
  
  // For direct PDF URLs, return as-is
  return pdfUrl
}

// Get platform name for display
const getPlatformName = (url: string | null | undefined): string => {
  if (!url) return 'PDF'
  const urlLower = url.toLowerCase()
  if (urlLower.includes('drive.google.com')) return 'Google Drive'
  if (urlLower.includes('github.com')) return 'GitHub'
  if (urlLower.includes('overleaf.com')) return 'Overleaf'
  return 'PDF'
}

// Watch for changes and save state
watch([searchQuery, showSOPDetail], () => {
  if (isInitialized.value) {
    saveState()
  }
})

// Watch scroll position and save (with debounce)
let scrollTimeout: NodeJS.Timeout | null = null
const handleScroll = () => {
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  scrollTimeout = setTimeout(() => {
    if (isInitialized.value && !showSOPDetail.value) {
      saveState()
    }
  }, 300) // Debounce scroll saves
}

// Find SOP by name, field, or institution
const findSOPByQuery = (name?: string, field?: string, institution?: string): SOPData | null => {
  if (!name && !field && !institution) return null
  
  // Try to find exact match first
  let found: SOPData | null = allSOPs.value.find(sop => {
    const nameMatch = !name || sop.name.toLowerCase().includes(name.toLowerCase())
    const fieldMatch = !field || sop.field.toLowerCase().includes(field.toLowerCase())
    const institutionMatch = !institution || sop.institution.toLowerCase().includes(institution.toLowerCase())
    return nameMatch && fieldMatch && institutionMatch
  }) || null
  
  // If not found, try partial matches
  if (!found && name) {
    found = allSOPs.value.find(sop => 
      sop.name.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(sop.name.toLowerCase())
    ) || null
  }
  
  return found
}

// Initialize
onMounted(async () => {
  // Load saved state
  const savedState = loadState()
  if (savedState) {
    searchQuery.value = savedState.searchQuery || ''
  }
  
  // Load SOPs
  await loadAllSOPs()
  
  // Load editor content from localStorage
  const savedContent = loadEditorContentFromLocalStorage()
  if (savedContent) {
    editorContent.value = savedContent
  }
  
  // Mark as initialized after loading content
  await nextTick()
  isInitialized.value = true
  
  // Check for query parameters to show specific SOP
  const queryName = route.query.name as string | undefined
  const queryField = route.query.field as string | undefined
  const queryInstitution = route.query.institution as string | undefined
  
  if (queryName || queryField || queryInstitution) {
    const foundSOP = findSOPByQuery(queryName, queryField, queryInstitution)
    if (foundSOP) {
      // Clear query parameters
      router.replace({ path: '/sop', query: {} })
      // Select and show the SOP
      selectReferenceSOP(foundSOP)
    }
  }
  
  // Wait for DOM to update
  await nextTick()
  
  // Restore scroll position if returning from detail view (only if no query params)
  if (!queryName && !queryField && !queryInstitution && savedState && savedState.scrollPosition && sopListContainer.value) {
    setTimeout(() => {
      if (sopListContainer.value) {
        sopListContainer.value.scrollTop = savedState.scrollPosition || 0
      }
    }, 100)
  }
  
  // Add scroll listener
  if (sopListContainer.value) {
    sopListContainer.value.addEventListener('scroll', handleScroll)
  }
  
  // Mark as initialized after everything is set up
  isInitialized.value = true
})

// Auto-save editor content to localStorage (debounced)
let isSavingContent = false // Prevent recursive saves
let saveContentTimeout: NodeJS.Timeout | null = null

watch(editorContent, (newContent, oldContent) => {
  // Only save if initialized and not during initialization
  if (!isInitialized.value || !auth.user) {
    return
  }
  
  // Prevent saving empty content if we had content before
  if (!newContent && oldContent) {
    return
  }
  
  // Clear previous timeout
  if (saveContentTimeout) {
    clearTimeout(saveContentTimeout)
  }
  
  // Debounce save
  saveContentTimeout = setTimeout(() => {
    if (!isSavingContent && auth.user && isInitialized.value) {
      isSavingContent = true
      try {
        saveEditorContentToLocalStorage()
      } finally {
        nextTick(() => {
          isSavingContent = false
        })
      }
    }
  }, 1000) // Auto-save after 1 second of inactivity
})
>>>>>>> 1878c60 (Enhance SOP view and intelligent search, remove documentation)
</script>

<template>
  <div class="flex h-screen bg-background overflow-hidden">
    <Sidebar />
    <main class="flex-1 overflow-hidden">
      <div class="h-full flex">
        <!-- Left: SOP Browser -->
        <div class="w-[45%] border-r border-border flex flex-col bg-background overflow-hidden">
          <!-- List View -->
          <div v-if="!showSOPDetail" class="flex flex-col h-full">
            <!-- Header Card -->
            <Card class="m-4 p-4">
              <div class="space-y-4">
                <div>
                  <h2 class="text-2xl font-bold mb-2">SOP Reference Library</h2>
                  <p class="text-sm text-muted-foreground">Browse example SOPs from successful PhD applicants</p>
                </div>
                
                <!-- Search Input -->
                <Input
                  :value="searchQuery"
                  @update:value="(val: string) => searchQuery = val"
                  placeholder="Search by name, field, institution..."
                  class="w-full"
                />
                
                <!-- SOP Count -->
                <p class="text-xs text-muted-foreground">
                  {{ filteredSOPs.length }} SOP{{ filteredSOPs.length !== 1 ? 's' : '' }} found
                </p>
              </div>
            </Card>
            
            <!-- SOP List -->
            <div 
              ref="sopListContainer"
              class="flex-1 overflow-y-auto px-4 pb-4 space-y-3"
            >
              <Card
                v-for="sop in filteredSOPs"
                :key="`${sop.name}-${sop.institution}`"
                class="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                @click="selectReferenceSOP(sop)"
              >
                <div class="space-y-2">
                  <h3 class="font-semibold text-lg">{{ sop.name }}</h3>
                  <div class="flex flex-wrap gap-2">
                    <Badge variant="outline">{{ sop.field }}</Badge>
                    <Badge variant="outline">{{ sop.institution }}</Badge>
                  </div>
                  <p class="text-sm text-muted-foreground line-clamp-2">
                    {{ sop.statementLink || sop.content.substring(0, 150) }}{{ !sop.statementLink && sop.content.length > 150 ? '...' : '' }}
                  </p>
                  <div v-if="sop.statementLink" class="mt-2">
                    <Badge variant="outline" class="text-xs">PDF Available</Badge>
                  </div>
                </div>
              </Card>
              
              <!-- Loading State -->
              <div v-if="loadingSOPs" class="text-center py-8 text-muted-foreground">
                Loading SOPs...
              </div>
              
              <!-- Empty State -->
              <div v-if="!loadingSOPs && filteredSOPs.length === 0" class="text-center py-8 text-muted-foreground">
                <p class="text-lg mb-2">No SOPs found</p>
                <p class="text-sm">{{ searchQuery ? 'Try a different search term' : 'No SOPs available' }}</p>
              </div>
            </div>
          </div>
          
          <!-- Detail View -->
          <div v-else class="flex flex-col h-full">
            <!-- Header Card with Back Button -->
            <Card class="m-4 mb-0 p-4">
              <div class="flex items-center gap-3 mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  @click="backToList"
                  class="h-8 w-8"
                >
                  ←
                </Button>
                <div class="flex-1">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <h2 class="text-xl font-bold">{{ selectedSOP?.name }}</h2>
                      <div class="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">{{ selectedSOP?.field }}</Badge>
                        <Badge variant="outline">{{ selectedSOP?.institution }}</Badge>
                      </div>
                      <!-- Display statementLink if available -->
                      <div v-if="selectedSOP?.statementLink" class="mt-3 pt-3 border-t">
                        <a 
                          :href="selectedSOP.statementLink" 
                          target="_blank"
                          class="text-sm text-primary hover:underline flex items-center gap-2"
                        >
                          <span>View Source: {{ selectedSOP.statementLink }}</span>
                          <span>↗</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            
            <!-- PDF Preview -->
            <div class="flex-1 overflow-hidden px-4 pb-4">
              <Card class="h-full flex flex-col">
                <!-- PDF Preview (if available) -->
                <div v-if="getPDFUrl(selectedSOP)" class="flex-1 overflow-hidden flex flex-col">
                  <!-- PDF Preview iframe -->
                  <div class="flex-1 overflow-hidden relative">
                    <iframe
                      :src="getPDFUrl(selectedSOP)"
                      class="w-full h-full border-0"
                      allow="autoplay"
                      frameborder="0"
                      @error="handlePDFError"
                    />
                  </div>
                  <!-- Link to open in new tab -->
                  <div class="p-3 border-t bg-muted/30 flex items-center justify-between">
                    <a 
                      :href="selectedSOP?.statementLink ? getDirectUrl(selectedSOP.statementLink) : (getPDFUrl(selectedSOP) || '#')" 
                      target="_blank"
                      class="text-sm text-primary hover:underline flex items-center gap-2"
                    >
                      <span>Open PDF in new tab</span>
                      <span>↗</span>
                    </a>
                    <p class="text-xs text-muted-foreground">
                      {{ getPlatformName(selectedSOP?.statementLink) }}
                    </p>
                  </div>
                </div>
                
                <!-- No PDF available -->
                <div v-else class="flex-1 flex items-center justify-center text-muted-foreground">
                  <div class="text-center">
                    <p class="text-lg mb-2">No PDF available</p>
                    <p class="text-sm mb-4">This SOP does not have a PDF link</p>
                    <div v-if="selectedSOP?.statementLink">
                      <a 
                        :href="selectedSOP.statementLink" 
                        target="_blank"
                        class="text-primary hover:underline inline-flex items-center gap-2"
                      >
                        <span>View Statement Link</span>
                        <span>↗</span>
                      </a>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
        
        <!-- Right: Markdown Editor -->
        <div class="flex-1 flex flex-col bg-background overflow-hidden">
          <Card class="m-4 mb-0 p-4">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xl font-bold">SOP Editor</h2>
                <p class="text-sm text-muted-foreground mt-1">Write and preview your Statement of Purpose</p>
              </div>
              <Button
                @click="exportAsMarkdown"
                :disabled="!editorContent.trim()"
                variant="default"
                size="sm"
              >
                <span>Export MD</span>
              </Button>
            </div>
          </Card>
          
          <!-- Markdown Editor with Preview -->
          <div class="flex-1 overflow-hidden px-4 pb-4">
            <Card class="h-full flex flex-col overflow-hidden">
              <MdEditor
                v-model="editorContent"
                :theme="editorTheme"
                language="en-US"
                previewTheme="github"
                codeTheme="github"
                :toolbars="[
                  'bold',
                  'underline',
                  'italic',
                  '-',
                  'title',
                  'strikeThrough',
                  'sub',
                  'sup',
                  'quote',
                  'unorderedList',
                  'orderedList',
                  'task',
                  '-',
                  'codeRow',
                  'code',
                  'link',
                  'table',
                  '-',
                  'revoke',
                  'next',
                  'save',
                  '=',
                  'pageFullscreen',
                  'fullscreen',
                  'preview',
                  'catalog'
                ]"
                placeholder="Start writing your Statement of Purpose here...

You can use Markdown formatting:
# Heading 1
## Heading 2
**bold text**
*italic text*
[link text](url)"
                class="h-full"
                style="height: 100%;"
              />
            </Card>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Override md-editor-v3 styles to match app theme */
:deep(.md-editor) {
  border: 1px solid hsl(var(--border));
  background-color: hsl(var(--background));
}

:deep(.md-editor-dark) {
  background-color: hsl(var(--background));
  border-color: hsl(var(--border));
}

:deep(.md-editor-preview) {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}

:deep(.md-editor-preview-dark) {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
</style>
