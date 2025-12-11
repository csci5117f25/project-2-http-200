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

export type LORStatus = 'not_contacted' | 'invited' | 'accepted' | 'submitted'

export interface LORTask {
  id?: string
  userId: string
  recommenderId: string
  applicationId: string
  status: LORStatus
  createdAt?: Date
  updatedAt?: Date
  lastUpdated?: Date
}

export const useLORTasks = defineStore('lorTasks', () => {
  const tasks = ref<LORTask[]>([])
  const loading = ref(false)
  const auth = useAuth()
  
  const unsubscribe = ref<(() => void) | null>(null)
  
  const init = () => {
    if (!auth.user || !('uid' in auth.user) || !auth.user.uid) return
    
    if (unsubscribe.value) {
      unsubscribe.value()
    }
    
    const tasksRef = collection(db, 'lorTasks')
    const q = query(tasksRef, where('userId', '==', auth.user.uid))
    
    unsubscribe.value = onSnapshot(q, (snapshot) => {
      tasks.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LORTask))
    })
  }
  
  const add = async (task: Omit<LORTask, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!auth.user || !('uid' in auth.user) || !auth.user.uid) {
      throw new Error('User not logged in')
    }
    
    try {
      loading.value = true
      const docRef = await addDoc(collection(db, 'lorTasks'), {
        ...task,
        userId: auth.user.uid,
        createdAt: new Date()
      })
      return docRef.id
    } catch (error) {
      console.error('Failed to add task:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  const update = async (id: string, data: Partial<LORTask>) => {
    if (!id) return
    
    try {
      loading.value = true
      await updateDoc(doc(db, 'lorTasks', id), {
        ...data,
        updatedAt: new Date(),
        lastUpdated: new Date()
      })
    } catch (error) {
      console.error('Failed to update task:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  const remove = async (id: string) => {
    if (!id) return
    
    try {
      loading.value = true
      await deleteDoc(doc(db, 'lorTasks', id))
    } catch (error) {
      console.error('Failed to delete task:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  const getTasksByRecommender = (recommenderId: string): LORTask[] => {
    return tasks.value.filter(task => task.recommenderId === recommenderId)
  }
  
  const getTasksByApplication = (applicationId: string): LORTask[] => {
    return tasks.value.filter(task => task.applicationId === applicationId)
  }
  
  return { 
    tasks, 
    loading, 
    init, 
    add, 
    update, 
    remove,
    getTasksByRecommender,
    getTasksByApplication
  }
})
