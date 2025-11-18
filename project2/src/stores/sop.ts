import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSOP = defineStore('sop', () => {
  const content = ref('')
  const references = ref([])
  
  const save = (text: string) => {
    content.value = text
  }
  
  const load = () => {
    // TODO: fetch from backend
  }
  
  return { content, references, save, load }
})
