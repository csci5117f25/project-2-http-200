<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProjects } from '../stores/projects'
import { useAuth } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'
import ProjectCard from '../components/ProjectCard.vue'
import CreateModal from '../components/CreateModal.vue'
import Card from '../components/ui/card.vue'
import Button from '../components/ui/button.vue'
import Badge from '../components/ui/badge.vue'
import { getColorClasses, initializeColorAssignments } from '../utils/colorTags'

const router = useRouter()
const projects = useProjects()
const auth = useAuth()
const showModal = ref(false)
const editing = ref<any>(null)

// Filter states
const selectedSchools = ref<Set<string>>(new Set())
const selectedSubfields = ref<Set<string>>(new Set())
const showSchoolToggle = ref(false)
const showSubfieldToggle = ref(false)

// Extract unique schools and subfields from all projects
const allSchools = computed(() => {
  const schools = new Set<string>()
  projects.projects.forEach(project => {
    if (project.school) {
      schools.add(project.school)
    }
  })
  return Array.from(schools).sort()
})

const allSubfields = computed(() => {
  const subfields = new Set<string>()
  projects.projects.forEach(project => {
    if (project.subfield) {
      // Support both single subfield and array of subfields
      if (Array.isArray(project.subfield)) {
        project.subfield.forEach((sf: string) => subfields.add(sf))
      } else {
        subfields.add(project.subfield)
      }
    }
  })
  return Array.from(subfields).sort()
})

// Initialize color assignments when schools or subfields change
watch([allSchools, allSubfields], ([schools, subfields]) => {
  initializeColorAssignments(schools, subfields)
}, { immediate: true })

// Filtered projects based on selections
const filteredProjects = computed(() => {
  return projects.projects.filter(project => {
    // School filter
    if (selectedSchools.value.size > 0 && !selectedSchools.value.has(project.school)) {
      return false
    }
    
    // Subfield filter
    if (selectedSubfields.value.size > 0) {
      const projectSubfields = Array.isArray(project.subfield) 
        ? project.subfield 
        : (project.subfield ? [project.subfield] : [])
      const hasSelectedSubfield = projectSubfields.some((sf: string) => selectedSubfields.value.has(sf))
      if (!hasSelectedSubfield) {
        return false
      }
    }
    
    return true
  })
})

// Toggle selection functions
const toggleSchool = (school: string) => {
  if (selectedSchools.value.has(school)) {
    selectedSchools.value.delete(school)
  } else {
    selectedSchools.value.add(school)
  }
}

const toggleSubfield = (subfield: string) => {
  if (selectedSubfields.value.has(subfield)) {
    selectedSubfields.value.delete(subfield)
  } else {
    selectedSubfields.value.add(subfield)
  }
}

const selectAllSchools = () => {
  if (selectedSchools.value.size === allSchools.value.length) {
    selectedSchools.value.clear()
  } else {
    selectedSchools.value = new Set(allSchools.value)
  }
}

const selectAllSubfields = () => {
  if (selectedSubfields.value.size === allSubfields.value.length) {
    selectedSubfields.value.clear()
  } else {
    selectedSubfields.value = new Set(allSubfields.value)
  }
}

// Wait for auth to load before initializing projects
watch(() => auth.loading, (isLoading) => {
  if (!isLoading && auth.user) {
    projects.init()
  }
}, { immediate: true })

onMounted(() => {
  if (!auth.loading && auth.user) {
    projects.init()
    // Reminders are now handled by Firebase Cloud Functions scheduled tasks
    // No need to check on dashboard visit
  }
})

const openModal = (project?: any) => {
  editing.value = project || null
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editing.value = null
}
</script>

<template>
  <div class="flex h-screen bg-background overflow-hidden">
    <Sidebar />
    
    <main class="flex-1 overflow-y-auto transition-all duration-300 ease-in-out">
      <div class="p-4 md:p-6">
        <div class="max-w-5xl lg:max-w-7xl mx-auto space-y-6">
          <!-- Title Card -->
          <Card class="p-6">
            <h1 class="text-3xl font-bold mb-2">Dashboard</h1>
            <p class="text-muted-foreground">Manage your PhD applications</p>
          </Card>

          <!-- Toggle Cards for Filters -->
          <div class="grid grid-cols-2 gap-4">
            <!-- School Toggle Card -->
            <Card class="relative">
              <div class="p-4">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-lg font-semibold">Schools</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    @click="showSchoolToggle = !showSchoolToggle"
                  >
                    {{ showSchoolToggle ? '−' : '+' }} Filter
                  </Button>
                </div>
                <div v-if="showSchoolToggle" class="flex items-center gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    @click="selectAllSchools"
                    class="text-xs"
                  >
                    {{ selectedSchools.size === allSchools.length ? 'Deselect All' : 'Select All' }}
                  </Button>
                  <span class="text-sm text-muted-foreground">
                    {{ selectedSchools.size > 0 ? `${selectedSchools.size}/${allSchools.length} selected` : `${allSchools.length} total` }}
                  </span>
                </div>
                <div v-else class="mb-2">
                  <span class="text-sm text-muted-foreground">
                    {{ allSchools.length }} total
                  </span>
                </div>
                <div v-if="showSchoolToggle" class="max-h-64 overflow-y-auto space-y-2 mt-2">
                  <div
                    v-for="school in allSchools"
                    :key="school"
                    class="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded"
                    @click="toggleSchool(school)"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedSchools.has(school)"
                      @click.stop
                      @change.stop="toggleSchool(school)"
                      class="w-4 h-4 cursor-pointer"
                    />
                    <Badge :class="getColorClasses(school, 'schools')" class="border">
                      {{ school }}
                    </Badge>
                    <span class="text-sm text-muted-foreground">
                      ({{ projects.projects.filter((p: any) => p.school === school).length }})
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <!-- Subfield Toggle Card -->
            <Card class="relative">
              <div class="p-4">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-lg font-semibold">Subfields</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    @click="showSubfieldToggle = !showSubfieldToggle"
                  >
                    {{ showSubfieldToggle ? '−' : '+' }} Filter
                  </Button>
                </div>
                <div v-if="showSubfieldToggle" class="flex items-center gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    @click="selectAllSubfields"
                    class="text-xs"
                  >
                    {{ selectedSubfields.size === allSubfields.length ? 'Deselect All' : 'Select All' }}
                  </Button>
                  <span class="text-sm text-muted-foreground">
                    {{ selectedSubfields.size > 0 ? `${selectedSubfields.size}/${allSubfields.length} selected` : `${allSubfields.length} total` }}
                  </span>
                </div>
                <div v-else class="mb-2">
                  <span class="text-sm text-muted-foreground">
                    {{ allSubfields.length }} total
                  </span>
                </div>
                <div v-if="showSubfieldToggle" class="max-h-64 overflow-y-auto space-y-2 mt-2">
                  <div
                    v-for="subfield in allSubfields"
                    :key="subfield"
                    class="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded"
                    @click="toggleSubfield(subfield)"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedSubfields.has(subfield)"
                      @click.stop
                      @change.stop="toggleSubfield(subfield)"
                      class="w-4 h-4 cursor-pointer"
                    />
                    <Badge :class="getColorClasses(subfield, 'subfields')" class="border">
                      {{ subfield }}
                    </Badge>
                    <span class="text-sm text-muted-foreground">
                      ({{ projects.projects.filter((p: any) => {
                        const projectSubfields = Array.isArray(p.subfield) ? p.subfield : (p.subfield ? [p.subfield] : [])
                        return projectSubfields.includes(subfield)
                      }).length }})
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <!-- Selected Filters Display Card -->
          <Card v-if="selectedSchools.size > 0 || selectedSubfields.size > 0" class="p-4">
            <div class="space-y-3">
              <!-- Selected Schools -->
              <div v-if="selectedSchools.size > 0">
                <h4 class="text-sm font-semibold mb-2">Selected Schools:</h4>
                <div class="flex flex-wrap gap-2">
                  <Badge
                    v-for="school in Array.from(selectedSchools)"
                    :key="school"
                    :class="getColorClasses(school, 'schools')"
                    class="border cursor-pointer hover:opacity-80"
                    @click="toggleSchool(school)"
                  >
                    {{ school }} ×
                  </Badge>
                </div>
              </div>

              <!-- Selected Subfields -->
              <div v-if="selectedSubfields.size > 0">
                <h4 class="text-sm font-semibold mb-2">Selected Subfields:</h4>
                <div class="flex flex-wrap gap-2">
                  <Badge
                    v-for="subfield in Array.from(selectedSubfields)"
                    :key="subfield"
                    :class="getColorClasses(subfield, 'subfields')"
                    class="border cursor-pointer hover:opacity-80"
                    @click="toggleSubfield(subfield)"
                  >
                    {{ subfield }} ×
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          <!-- Application Cards -->
          <div class="space-y-4">
            <ProjectCard 
              v-for="project in filteredProjects"
              :key="project.id"
              :data="project"
              @edit="openModal"
            />
            
            <Card 
              class="border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all cursor-pointer min-h-[200px] flex items-center justify-center"
              @click="openModal()"
            >
              <div class="flex flex-col items-center gap-3">
                <div class="text-5xl text-muted-foreground">+</div>
                <span class="text-muted-foreground font-medium">Create New Application</span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
    
    <CreateModal 
      v-if="showModal"
      :editData="editing"
      @close="closeModal"
    />
  </div>
</template>
