<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useProjects } from '../stores/projects'
import Sidebar from '../components/Sidebar.vue'
import ProjectCard from '../components/ProjectCard.vue'
import CreateModal from '../components/CreateModal.vue'

const projects = useProjects()
const showModal = ref(false)
const editing = ref<any>(null)

onMounted(() => {
  const saved = localStorage.getItem('projects')
  if (saved) {
    projects.projects = JSON.parse(saved)
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
  <div class="layout">
    <Sidebar />
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
  height: 100vh;
}

.main {
  flex: 3;
  padding: 38px;
  overflow-y: auto;
}

.projects {
  max-width: 1180px;
  display: flex;
  flex-direction: column;
  gap: 15px;
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
