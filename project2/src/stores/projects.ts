import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useProjects = defineStore('projects', () => {
  const projects = ref([])
  
  const add = (project: any) => {
    projects.value.push(project)
  }
  
  const remove = (id: string) => {
    projects.value = projects.value.filter((p: any) => p.id !== id)
  }
  
  const update = (id: string, data: any) => {
    const idx = projects.value.findIndex((p: any) => p.id === id)
    if (idx !== -1) {
      projects.value[idx] = { ...projects.value[idx], ...data }
    }
  }
  
  return { projects, add, remove, update }
})
