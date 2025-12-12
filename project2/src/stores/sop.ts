import { defineStore } from 'pinia'
import { ref } from 'vue'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './auth'

export const useSOP = defineStore('sop', () => {
  const content = ref('')
  const references = ref([])
  const auth = useAuth()
  
  const save = async (text: string) => {
    content.value = text
    if (!auth.user?.uid) return
    
    try {
      await setDoc(doc(db, 'userSOPs', auth.user.uid), {
        content: text,
        updatedAt: new Date(),
        userId: auth.user.uid
      })
    } catch (error) {
      console.error('Failed to save SOP:', error)
      throw error
    }
  }
  
  const load = async () => {
    if (!auth.user?.uid) {
      content.value = ''
      return
    }
    
    try {
      const docRef = doc(db, 'userSOPs', auth.user.uid)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        content.value = docSnap.data().content || ''
      } else {
        content.value = ''
      }
    } catch (error) {
      console.error('Failed to load SOP:', error)
      content.value = ''
    }
  }
  
  return { content, references, save, load }
})
