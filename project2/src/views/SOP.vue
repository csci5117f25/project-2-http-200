<script setup lang="ts">
import { useSOP } from '../stores/sop'
import Sidebar from '../components/Sidebar.vue'

const sop = useSOP()
</script>

<template>
  <div class="layout">
    <main>
      <div class="sop-container">
        <div class="reference">
          <!-- left: reference blocks -->
        </div>
        <div class="editor">
          <!-- right: editor -->
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

main {
  flex: 1;
}

.sop-container {
  display: flex;
  height: 100%;
}

.reference {
  width: 45%;
  border-right: 1px solid var(--border);
}

.editor {
  flex: 1;
}
</style>

