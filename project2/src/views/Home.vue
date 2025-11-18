<script setup lang="ts">
import { useProjects } from '../stores/projects'
import Sidebar from '../components/Sidebar.vue'

const projects = useProjects()
</script>

<template>
  <div class="layout">
    <Sidebar />
    <main>
      <div class="projects">
        <!-- project cards render here -->
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
}

main {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
}
</style>

