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
  onSnapshot,
  Timestamp
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './auth'

export interface Application {
  id?: string
  schoolName: string
  programName: string
  portalUrl?: string
  lorDeadline?: Date | string
  userId: string
  createdAt?: Date
  updatedAt?: Date
}

export const useApplications = defineStore('applications', () => {
  const applications = ref<Application[]>([])
  const loading = ref(false)
  const auth = useAuth()
  
  const unsubscribe = ref<(() => void) | null>(null)
  
  const init = () => {
    if (!auth.user?.uid) return
    
    if (unsubscribe.value) {
      unsubscribe.value()
    }
    
    const applicationsRef = collection(db, 'applications')
    const q = query(applicationsRef, where('userId', '==', auth.user.uid))
    
    unsubscribe.value = onSnapshot(q, (snapshot) => {
      applications.value = snapshot.docs.map(doc => {
        const data = doc.data()
        // Convert Firestore Timestamp to Date if needed
        if (data.lorDeadline) {
          if (data.lorDeadline instanceof Timestamp) {
            data.lorDeadline = data.lorDeadline.toDate()
          } else if (data.lorDeadline?.toDate && typeof data.lorDeadline.toDate === 'function') {
            data.lorDeadline = data.lorDeadline.toDate()
          } else if (typeof data.lorDeadline === 'string') {
            // If it's a string, try to parse it
            const parsed = new Date(data.lorDeadline)
            if (!isNaN(parsed.getTime())) {
              data.lorDeadline = parsed
            }
          }
        }
        return {
          id: doc.id,
          ...data
        } as Application
      })
    })
  }
  
  const add = async (application: Omit<Application, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!auth.user?.uid) {
      throw new Error('User not logged in')
    }
    
    try {
      loading.value = true
      // Convert Date objects to Firestore Timestamp format
      const appData: any = {
        ...application,
        userId: auth.user.uid,
        createdAt: new Date()
      }
      
      // Ensure lorDeadline is properly formatted
      if (appData.lorDeadline) {
        // If it's already a Date object, Firestore will convert it automatically
        // If it's a string, convert it to Date first
        if (typeof appData.lorDeadline === 'string') {
          appData.lorDeadline = new Date(appData.lorDeadline)
        }
      }
      
      const docRef = await addDoc(collection(db, 'applications'), appData)
      return docRef.id
    } catch (error) {
      console.error('Failed to add application:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  const update = async (id: string, data: Partial<Application>) => {
    if (!id) return
    
    try {
      loading.value = true
      const updateData: any = {
        ...data,
        updatedAt: new Date()
      }
      
      // Ensure lorDeadline is properly formatted
      if (updateData.lorDeadline) {
        // If it's a string, convert it to Date first
        if (typeof updateData.lorDeadline === 'string') {
          updateData.lorDeadline = new Date(updateData.lorDeadline)
        }
      }
      
      await updateDoc(doc(db, 'applications', id), updateData)
    } catch (error) {
      console.error('Failed to update application:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  const remove = async (id: string) => {
    if (!id) return
    
    try {
      loading.value = true
      await deleteDoc(doc(db, 'applications', id))
    } catch (error) {
      console.error('Failed to delete application:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  return { applications, loading, init, add, update, remove }
})

