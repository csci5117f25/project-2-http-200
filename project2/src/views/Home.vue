<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useProjects } from '../stores/projects'
import { useAuth } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'
import ProjectCard from '../components/ProjectCard.vue'
import CreateModal from '../components/CreateModal.vue'

const router = useRouter()
const projects = useProjects()
const auth = useAuth()
const showModal = ref(false)
const editing = ref<any>(null)

// Wait for auth to load before initializing projects
watch(() => auth.loading, (isLoading) => {
  if (!isLoading && auth.user) {
    projects.init()
  }
}, { immediate: true })

onMounted(() => {
  if (!auth.loading && auth.user) {
    projects.init()
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

const getInitial = () => {
  return auth.user?.email?.[0]?.toUpperCase() || 'U'
}
</script>

<template>
  <div class="layout">
    <header class="header">
      <div class="brand" @click="router.push('/home')">
        <div class="logo">PhD</div>
        <span class="title">App Hub</span>
      </div>
      <div class="avatar">
        <div class="circle">{{ getInitial() }}</div>
      </div>
    </header>
    
    <main class="main">
      <div class="projects">
        <ProjectCard 
          v-for="project in projects.projects"
          :key="project.id"
          :data="project"
          @edit="openModal"
        />
        
        <div class="add-card" @click="openModal()">
          <div class="plus">+</div>
          <span>Create New Project</span>
        </div>
      </div>
    </main>
    
    <Sidebar />
    
    <CreateModal 
      v-if="showModal"
      :editData="editing"
      @close="closeModal"
    />
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 38px;
  background: white;
  border-bottom: 1px solid var(--border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 13px;
  cursor: pointer;
}

.logo {
  width: 52px;
  height: 52px;
  background: linear-gradient(135deg, var(--coral), #ff8e6e);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.5px;
}

.title {
  font-size: 22px;
  font-weight: 700;
  color: var(--dark);
}

.avatar {
  display: flex;
}

.circle {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--coral);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 17px;
}

.main {
  flex: 1;
  padding: 38px;
  overflow-y: auto;
  display: flex;
  justify-content: center;
}

.projects {
  max-width: 1400px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-card {
  border: 2px dashed var(--border);
  border-radius: 12px;
  padding: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 11px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  min-height: 200px;
  justify-content: center;
}

.add-card:hover {
  border-color: var(--coral);
  background: rgba(255, 107, 107, 0.02);
}

.plus {
  font-size: 56px;
  color: var(--coral);
  line-height: 1;
}

.add-card span {
  color: var(--gray);
  font-size: 15px;
}
</style>
