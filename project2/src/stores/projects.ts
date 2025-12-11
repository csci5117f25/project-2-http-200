import { defineStore } from 'pinia'
import { ref } from 'vue'
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './auth'

export const useProjects = defineStore('projects', () => {
  const projects = ref<any[]>([])
  const loading = ref(false)
  const auth = useAuth()
  
  const unsubscribe = ref<(() => void) | null>(null)
  
  const init = () => {
    if (!auth.user?.uid) return
    
    if (unsubscribe.value) {
      unsubscribe.value()
    }
    
    const projectsRef = collection(db, 'projects')
    const q = query(projectsRef, where('userId', '==', auth.user.uid))
    
    unsubscribe.value = onSnapshot(q, (snapshot) => {
      projects.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    })
  }
  
  const add = async (project: any) => {
    if (!auth.user?.uid) {
      throw new Error('User not logged in')
    }
    
    try {
      loading.value = true
      const docRef = await addDoc(collection(db, 'projects'), {
        ...project,
        userId: auth.user.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      return docRef.id
    } catch (error) {
      console.error('Failed to add project:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  const remove = async (id: string) => {
    if (!id) return
    
    try {
      loading.value = true
      await deleteDoc(doc(db, 'projects', id))
    } catch (error) {
      console.error('Failed to delete project:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  const update = async (id: string, data: any) => {
    if (!id) return
    
    try {
      loading.value = true
      await updateDoc(doc(db, 'projects', id), {
        ...data,
        updatedAt: new Date()
      })
    } catch (error) {
      console.error('Failed to update project:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  return { projects, loading, init, add, remove, update }
})
