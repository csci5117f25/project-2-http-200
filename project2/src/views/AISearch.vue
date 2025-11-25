<script setup lang="ts">
import Sidebar from '../components/Sidebar.vue'
</script>

<template>
  <div class="layout">
    <main>
      <h1>AI Assisted Search</h1>
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

main {
  flex: 1;
  padding: 32px;
}
</style>

