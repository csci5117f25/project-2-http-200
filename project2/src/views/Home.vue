<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useProjects } from '../stores/projects'
import Sidebar from '../components/Sidebar.vue'
import ProjectCard from '../components/ProjectCard.vue'
import CreateModal from '../components/CreateModal.vue'

const projects = useProjects()
const showModal = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('projects')
  if (saved) {
    projects.projects = JSON.parse(saved)
  }
})
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
        />
        
        <div class="add-card" @click="showModal = true">
          <div class="plus">+</div>
          <span>Create New Project</span>
        </div>
      </div>
    </main>
    
    <CreateModal 
      v-if="showModal"
      @close="showModal = false"
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
  padding: 40px;
  overflow-y: auto;
}

.projects {
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.add-card {
  border: 2px dashed var(--border);
  border-radius: 12px;
  padding: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
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
