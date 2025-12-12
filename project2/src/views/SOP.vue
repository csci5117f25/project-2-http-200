<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
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
import { MdEditor, MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import 'md-editor-v3/lib/preview.css'

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
const editorMode = ref<'preview' | 'edit'>('preview') // Editor mode: preview (Typora-like) or edit
const leftPanelWidth = ref(45) // Left panel width percentage
const isResizing = ref(false) // Track if user is resizing

// Resize functionality - Optimized for smooth dragging
let resizeStartX = 0
let resizeStartWidth = 0
let resizeContainer: HTMLElement | null = null
let isDragging = false
let animationFrameId: number | null = null
let pendingWidth: number | null = null

// Store event handlers to ensure proper cleanup
let currentMouseMoveHandler: ((e: MouseEvent) => void) | null = null
let currentMouseUpHandler: (() => void) | null = null
let currentMouseLeaveHandler: (() => void) | null = null

// Store iframe references for disabling during drag
let pdfIframes: HTMLIFrameElement[] = []

// Find and disable all PDF iframes during drag
const disablePDFIframes = () => {
  pdfIframes = []
  const iframes = document.querySelectorAll('iframe[src*="drive.google.com"], iframe[src*="github.com"]')
  iframes.forEach((iframe) => {
    const iframeEl = iframe as HTMLIFrameElement
    pdfIframes.push(iframeEl)
    iframeEl.style.pointerEvents = 'none'
    // Also disable pointer events on the iframe's parent container
    const parent = iframeEl.parentElement
    if (parent) {
      parent.style.pointerEvents = 'none'
    }
  })
}

// Re-enable all PDF iframes after drag
const enablePDFIframes = () => {
  pdfIframes.forEach((iframe) => {
    iframe.style.pointerEvents = ''
    const parent = iframe.parentElement
    if (parent) {
      parent.style.pointerEvents = ''
    }
  })
  pdfIframes = []
}

// Cleanup function to ensure all listeners are removed
const cleanupResizeListeners = () => {
  if (currentMouseMoveHandler) {
    document.removeEventListener('mousemove', currentMouseMoveHandler)
    currentMouseMoveHandler = null
  }
  if (currentMouseUpHandler) {
    document.removeEventListener('mouseup', currentMouseUpHandler)
    window.removeEventListener('blur', currentMouseUpHandler)
    currentMouseUpHandler = null
  }
  if (currentMouseLeaveHandler) {
    document.removeEventListener('mouseleave', currentMouseLeaveHandler)
    currentMouseLeaveHandler = null
  }
  
  // Cancel animation frame
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  
  // Apply final pending width if any
  if (pendingWidth !== null) {
    leftPanelWidth.value = pendingWidth
    pendingWidth = null
  }
  
  // Re-enable PDF iframes
  enablePDFIframes()
  
  // Restore body styles
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.body.style.pointerEvents = ''
  
  // Reset state
  isDragging = false
  isResizing.value = false
  resizeStartX = 0
  resizeStartWidth = 0
  resizeContainer = null
}

const startResize = (e: MouseEvent) => {
  // Prevent default to avoid text selection
  e.preventDefault()
  e.stopPropagation()
  
  // Always cleanup any existing listeners first
  cleanupResizeListeners()
  
  if (isDragging) return // Already dragging (shouldn't happen after cleanup)
  
  isDragging = true
  isResizing.value = true
  
  resizeStartX = e.clientX
  resizeStartWidth = leftPanelWidth.value
  resizeContainer = (e.target as HTMLElement).closest('main')?.parentElement || null
  
  if (!resizeContainer) {
    cleanupResizeListeners()
    return
  }
  
  const containerWidth = resizeContainer.clientWidth
  
  // Use requestAnimationFrame for smooth updates
  const updateWidth = () => {
    if (pendingWidth !== null) {
      leftPanelWidth.value = pendingWidth
      pendingWidth = null
    }
    if (isDragging) {
      animationFrameId = requestAnimationFrame(updateWidth)
    }
  }
  
  const handleMouseMove = (moveEvent: MouseEvent) => {
    if (!isDragging || !resizeContainer) {
      cleanupResizeListeners()
      return
    }
    
    const diff = moveEvent.clientX - resizeStartX
    const diffPercent = (diff / containerWidth) * 100
    const newWidth = resizeStartWidth + diffPercent
    const clampedWidth = Math.max(30, Math.min(70, newWidth))
    
    // Queue the update for next animation frame
    pendingWidth = clampedWidth
  }
  
  const handleMouseUp = () => {
    cleanupResizeListeners()
  }
  
  const handleMouseLeave = () => {
    cleanupResizeListeners()
  }
  
  // Store handlers for cleanup
  currentMouseMoveHandler = handleMouseMove
  currentMouseUpHandler = handleMouseUp
  currentMouseLeaveHandler = handleMouseLeave
  
  // Add event listeners with passive: false for better performance
  document.addEventListener('mousemove', handleMouseMove, { passive: false })
  document.addEventListener('mouseup', handleMouseUp, { passive: false })
  document.addEventListener('mouseleave', handleMouseLeave, { passive: false })
  
  // Also listen on window for better coverage (especially for iframes)
  window.addEventListener('blur', handleMouseUp, { passive: false })
  currentMouseUpHandler = handleMouseUp // Store for cleanup
  
  // Disable PDF iframes to prevent interaction during drag
  disablePDFIframes()
  
  // Set body styles to prevent text selection during drag
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.body.style.pointerEvents = 'auto'
  
  // Start animation frame loop
  animationFrameId = requestAnimationFrame(updateWidth)
}

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
// Enhanced search with multi-word, weighted scoring, and fuzzy matching
const filteredSOPs = computed(() => {
  if (!searchQuery.value.trim()) return allSOPs.value
  
  const query = searchQuery.value.toLowerCase().trim()
  const queryWords = query.split(/\s+/).filter(word => word.length > 0)
  
  // Score each SOP
  const scoredSOPs = allSOPs.value.map(sop => {
    let score = 0
    let matchCount = 0
    
    const nameLower = sop.name.toLowerCase()
    const fieldLower = sop.field.toLowerCase()
    const institutionLower = sop.institution.toLowerCase()
    const contentLower = sop.content.toLowerCase()
    
    // Multi-word search: each word must match somewhere (AND logic)
    for (const word of queryWords) {
      let wordMatched = false
      
      // Exact match gets highest score
      if (nameLower === word || fieldLower === word || institutionLower === word) {
        score += 20
        wordMatched = true
      }
      
      // Name matches (highest priority)
      if (nameLower.includes(word)) {
        score += 15
        wordMatched = true
      } else if (fuzzyMatch(nameLower, word)) {
        score += 10
        wordMatched = true
      }
      
      // Field matches (high priority)
      if (fieldLower.includes(word)) {
        score += 12
        wordMatched = true
      } else if (fuzzyMatch(fieldLower, word)) {
        score += 8
        wordMatched = true
      }
      
      // Institution matches (high priority)
      if (institutionLower.includes(word)) {
        score += 10
        wordMatched = true
      } else if (fuzzyMatch(institutionLower, word)) {
        score += 6
        wordMatched = true
      }
      
      // Content matches (lower priority)
      if (contentLower.includes(word)) {
        score += 3
        wordMatched = true
      } else if (fuzzyMatch(contentLower, word)) {
        score += 1
        wordMatched = true
      }
      
      if (wordMatched) {
        matchCount++
      }
    }
    
    // Bonus for matching all words
    if (matchCount === queryWords.length) {
      score += 5
    }
    
    // Penalty for partial matches (not all words matched)
    if (matchCount < queryWords.length && matchCount > 0) {
      score = score * (matchCount / queryWords.length)
    }
    
    return { sop, score, matchCount }
  })
  
  // Filter: must match at least one word, and if multiple words, prefer matches with more words
  const filtered = scoredSOPs.filter(item => item.matchCount > 0)
  
  // Sort by score (descending), then by matchCount (descending)
  filtered.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return b.matchCount - a.matchCount
  })
  
  return filtered.map(item => item.sop)
})

// Fuzzy matching helper: checks if target contains word with some tolerance
function fuzzyMatch(target: string, word: string): boolean {
  if (word.length < 3) return false // Too short for fuzzy matching
  
  // Exact substring match
  if (target.includes(word)) return true
  
  // Check for word with missing characters (e.g., "stanford" matches "stanfrd")
  if (word.length >= 4) {
    let targetIndex = 0
    let wordIndex = 0
    let mismatches = 0
    
    while (targetIndex < target.length && wordIndex < word.length) {
      if (target[targetIndex] === word[wordIndex]) {
        targetIndex++
        wordIndex++
      } else {
        // Allow one missing character
        if (mismatches < 1 && wordIndex > 0) {
          wordIndex++
          mismatches++
        } else {
          targetIndex++
        }
      }
    }
    
    if (wordIndex === word.length) return true
  }
  
  // Check for similar words (Levenshtein-like, simplified)
  if (word.length >= 4) {
    const targetWords = target.split(/\s+/)
    for (const targetWord of targetWords) {
      if (targetWord.length >= word.length - 1 && targetWord.length <= word.length + 1) {
        let differences = 0
        const minLen = Math.min(targetWord.length, word.length)
        for (let i = 0; i < minLen; i++) {
          if (targetWord[i] !== word[i]) differences++
        }
        differences += Math.abs(targetWord.length - word.length)
        // Allow up to 1-2 character differences for words of length 4+
        if (differences <= Math.max(1, Math.floor(word.length / 4))) {
          return true
        }
      }
    }
  }
  
  return false
}

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
// Cleanup on component unmount
onBeforeUnmount(() => {
  cleanupResizeListeners()
})

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
</script>

<template>
  <div class="flex h-screen bg-background overflow-hidden">
    <Sidebar />
    <main class="flex-1 overflow-hidden">
      <div class="h-full flex">
        <!-- Left: SOP Browser -->
        <div 
          class="h-full flex flex-col bg-background overflow-hidden"
          :style="{ 
            width: `${leftPanelWidth}%`, 
            minWidth: '30%', 
            maxWidth: '70%',
            transition: isResizing ? 'none' : 'width 0.2s ease-out'
          }"
        >
          <!-- List View -->
          <div v-if="!showSOPDetail" class="flex flex-col h-full overflow-hidden">
            <!-- SOP List Container -->
            <div 
              ref="sopListContainer"
              class="flex-1 overflow-y-auto px-4 pb-4 space-y-3 overflow-x-hidden sop-list-scrollable"
            >
              <!-- Header Card - Aligned with Editor top card -->
              <Card class="p-4 mt-4">
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
          <div v-else class="flex flex-col h-full overflow-hidden">
            <!-- Header Card with Back Button -->
            <Card class="m-4 mb-0 p-4 relative">
              <!-- Back Button - Fixed to top-right corner -->
              <Button
                variant="ghost"
                size="icon"
                @click="backToList"
                class="absolute top-4 right-4 h-8 w-8 z-10"
              >
                ←
              </Button>
              
              <div class="pr-10">
                <div class="flex-1">
                  <h2 class="text-xl font-bold pr-8">{{ selectedSOP?.name }}</h2>
                  <div class="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline">{{ selectedSOP?.field }}</Badge>
                    <Badge variant="outline">{{ selectedSOP?.institution }}</Badge>
                  </div>
                  <!-- Display statementLink if available -->
                  <div v-if="selectedSOP?.statementLink" class="mt-3 pt-3 border-t border-border overflow-hidden">
                    <div class="text-sm text-muted-foreground mb-1">View Source:</div>
                    <a 
                      :href="selectedSOP.statementLink" 
                      target="_blank"
                      class="text-sm text-primary hover:underline break-all word-break break-words overflow-wrap-anywhere block"
                      style="word-break: break-all; overflow-wrap: anywhere;"
                    >
                      {{ selectedSOP.statementLink }}
                      <span class="inline-block ml-1">↗</span>
                    </a>
                  </div>
                </div>
              </div>
            </Card>
            
            <!-- PDF Preview -->
            <div class="flex-1 overflow-hidden px-4 pb-4">
              <Card class="h-full flex flex-col">
                <!-- PDF Preview (if available) -->
                <div v-if="getPDFUrl(selectedSOP)" class="flex-1 overflow-hidden flex flex-col pdf-preview-container">
                  <!-- PDF Preview iframe -->
                  <div class="flex-1 overflow-hidden relative">
                    <iframe
                      :src="getPDFUrl(selectedSOP) || undefined"
                      class="w-full h-full border-0 pdf-iframe"
                      :style="{ pointerEvents: isResizing ? 'none' : 'auto' }"
                      allow="autoplay"
                      frameborder="0"
                      @error="handlePDFError"
                    />
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
        
        <!-- Resizable Handle - Subtle and modern -->
        <div
          class="relative flex-shrink-0 z-20 resizable-handle-container"
          style="width: 2px; margin-left: 4px;"
        >
          <div
            class="absolute inset-0 bg-border hover:bg-primary/40 transition-colors cursor-col-resize"
            @mousedown="startResize"
            :class="{ 'bg-primary/60': isResizing }"
            style="left: -4px; right: -4px; width: calc(100% + 8px);"
          />
        </div>
        
        <!-- Right: Markdown Editor -->
        <div 
          class="h-full flex flex-col bg-background overflow-hidden flex-1"
          :style="{ minWidth: '30%' }"
        >
          <Card class="m-4 mb-0 p-4">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 class="text-xl font-bold">SOP Editor</h2>
                <p class="text-sm text-muted-foreground mt-1">Write and preview your Statement of Purpose</p>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <Button
                  @click="editorMode = editorMode === 'preview' ? 'edit' : 'preview'"
                  variant="outline"
                  size="sm"
                >
                  <span>{{ editorMode === 'preview' ? 'Edit' : 'Preview' }}</span>
                </Button>
                <Button
                  @click="exportAsMarkdown"
                  :disabled="!editorContent.trim()"
                  variant="default"
                  size="sm"
                >
                  <span>Export MD</span>
                </Button>
              </div>
            </div>
          </Card>
          
          <!-- Markdown Editor - Preview Mode (Typora-like) -->
          <div class="flex-1 overflow-hidden px-4 pb-4">
            <Card class="h-full flex flex-col overflow-hidden">
              <!-- Preview Mode: Use MdPreview for pure preview -->
              <MdPreview
                v-if="editorMode === 'preview'"
                :modelValue="editorContent"
                :theme="editorTheme"
                previewTheme="github"
                codeTheme="github"
                class="h-full overflow-y-auto"
                style="height: 100%;"
              />
              <!-- Edit Mode: Use MdEditor for editing -->
              <MdEditor
                v-else
                v-model="editorContent"
                :theme="editorTheme"
                mode="edit"
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
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.8;
}

:deep(.md-editor-preview-dark) {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}

/* Preview component styling */
:deep(.md-preview-wrapper) {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.8;
}

:deep(.md-preview) {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}

/* Ensure lists display correctly in MdPreview */
:deep(.md-preview ul),
:deep(.md-preview ol) {
  margin-bottom: 1rem;
  padding-left: 2rem;
  display: block;
}

:deep(.md-preview ul) {
  list-style-type: disc;
}

:deep(.md-preview ol) {
  list-style-type: decimal;
}

:deep(.md-preview li) {
  display: list-item !important;
  margin-bottom: 0.5rem;
  list-style-position: outside;
  list-style-type: inherit;
}

/* Remove any pseudo-elements that might cause duplication */
:deep(.md-preview li::before),
:deep(.md-preview li::after) {
  content: none !important;
  display: none !important;
}

:deep(.md-preview ul ul),
:deep(.md-preview ol ol),
:deep(.md-preview ul ol),
:deep(.md-preview ol ul) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

:deep(.md-preview ul ul) {
  list-style-type: circle;
}

:deep(.md-preview ul ul ul) {
  list-style-type: square;
}

/* Typora-like preview styling */
:deep(.md-editor-preview-wrapper) {
  padding: 2rem;
}

:deep(.md-editor-preview h1) {
  font-size: 2rem;
  font-weight: 700;
  margin-top: 2rem;
  margin-bottom: 1rem;
  border-bottom: 2px solid hsl(var(--border));
  padding-bottom: 0.5rem;
}

:deep(.md-editor-preview h2) {
  font-size: 1.5rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}

:deep(.md-editor-preview h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}

:deep(.md-editor-preview p) {
  margin-bottom: 1rem;
}

:deep(.md-editor-preview ul),
:deep(.md-editor-preview ol) {
  margin-bottom: 1rem;
  padding-left: 2rem;
  display: block;
}

:deep(.md-editor-preview ul) {
  list-style-type: disc;
}

:deep(.md-editor-preview ol) {
  list-style-type: decimal;
}

:deep(.md-editor-preview li) {
  display: list-item !important;
  margin-bottom: 0.5rem;
  list-style-position: outside !important;
  list-style-type: inherit !important;
  content: none !important;
}

/* Remove any pseudo-elements that might cause duplication */
:deep(.md-editor-preview li::before),
:deep(.md-editor-preview li::after) {
  content: none !important;
  display: none !important;
}

/* Remove any pseudo-elements that might cause duplication */
:deep(.md-editor-preview li::before),
:deep(.md-editor-preview li::after) {
  content: none !important;
  display: none !important;
}

:deep(.md-editor-preview ul ul),
:deep(.md-editor-preview ol ol),
:deep(.md-editor-preview ul ol),
:deep(.md-editor-preview ol ul) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

:deep(.md-editor-preview ul ul) {
  list-style-type: circle;
}

:deep(.md-editor-preview ul ul ul) {
  list-style-type: square;
}

:deep(.md-editor-preview blockquote) {
  border-left: 4px solid hsl(var(--primary));
  padding-left: 1rem;
  margin-left: 0;
  margin-bottom: 1rem;
  color: hsl(var(--muted-foreground));
}

:deep(.md-editor-preview code) {
  background-color: hsl(var(--muted));
  padding: 0.2rem 0.4rem;
  border-radius: 0.25rem;
  font-size: 0.9em;
}

:deep(.md-editor-preview pre) {
  background-color: hsl(var(--muted));
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 1rem;
}

:deep(.md-editor-preview pre code) {
  background-color: transparent;
  padding: 0;
}

/* Resizable Handle - Ensure visibility and proper layering */
main > div > div:has([class*="cursor-col-resize"]) {
  position: relative;
  z-index: 20;
}

/* Smooth resizing - disable transitions during drag */
.resizable-handle-container {
  will-change: transform;
}

/* Disable PDF iframe interaction during resize */
.pdf-preview-container {
  transition: pointer-events 0s;
}

.pdf-preview-container:has(.resizable-handle-container:hover) {
  pointer-events: none;
}

/* Ensure left panel content doesn't overflow */
main > div > div:first-child {
  overflow-x: hidden;
  box-sizing: border-box;
}

/* SOP List scrollbar styling - separate from resizable handle */
.sop-list-scrollable {
  padding-right: 0.75rem; /* Add padding to separate scrollbar from resizable handle */
}

.sop-list-scrollable::-webkit-scrollbar {
  width: 8px;
}

.sop-list-scrollable::-webkit-scrollbar-track {
  background: transparent;
  margin-right: 2px; /* Add margin to separate from resizable handle */
}

.sop-list-scrollable::-webkit-scrollbar-thumb {
  background-color: hsl(var(--border));
  border-radius: 4px;
}

.sop-list-scrollable::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--muted-foreground) / 0.5);
}

/* Firefox scrollbar */
.sop-list-scrollable {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent;
}

/* Markdown Editor Toolbar - Enable horizontal scrolling */
:deep(.md-editor-toolbar-wrapper) {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent;
}

:deep(.md-editor-toolbar-wrapper::-webkit-scrollbar) {
  height: 6px;
}

:deep(.md-editor-toolbar-wrapper::-webkit-scrollbar-track) {
  background: transparent;
}

:deep(.md-editor-toolbar-wrapper::-webkit-scrollbar-thumb) {
  background-color: hsl(var(--border));
  border-radius: 3px;
}

:deep(.md-editor-toolbar-wrapper::-webkit-scrollbar-thumb:hover) {
  background-color: hsl(var(--muted-foreground) / 0.5);
}

:deep(.md-editor-toolbar) {
  min-width: max-content;
  flex-wrap: nowrap;
}

</style>
