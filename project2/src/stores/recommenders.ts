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

export interface Recommender {
  id?: string
  name: string
  email: string
  affiliation?: string
  userId: string
  createdAt?: Date
  updatedAt?: Date
}

export const useRecommenders = defineStore('recommenders', () => {
  const recommenders = ref<Recommender[]>([])
  const loading = ref(false)
  const auth = useAuth()
  
  const unsubscribe = ref<(() => void) | null>(null)
  
  const init = () => {
    if (!auth.user || !('uid' in auth.user) || !auth.user.uid) return
    
    if (unsubscribe.value) {
      unsubscribe.value()
    }
    
    const recommendersRef = collection(db, 'recommenders')
    const q = query(recommendersRef, where('userId', '==', auth.user.uid))
    
    unsubscribe.value = onSnapshot(q, (snapshot) => {
      recommenders.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Recommender))
    })
  }
  
  const add = async (recommender: Omit<Recommender, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!auth.user || !('uid' in auth.user) || !auth.user.uid) {
      throw new Error('User not logged in')
    }
    
    try {
      loading.value = true
      const docRef = await addDoc(collection(db, 'recommenders'), {
        ...recommender,
        userId: auth.user.uid,
        createdAt: new Date()
      })
      return docRef.id
    } catch (error) {
      throw error
    } finally {
      loading.value = false
    }
  }
  
  const update = async (id: string, data: Partial<Recommender>) => {
    if (!id) return
    
    try {
      loading.value = true
      await updateDoc(doc(db, 'recommenders', id), {
        ...data,
        updatedAt: new Date()
      })
    } catch (error) {
      throw error
    } finally {
      loading.value = false
    }
  }
  
  const remove = async (id: string) => {
    if (!id) return
    
    try {
      loading.value = true
      await deleteDoc(doc(db, 'recommenders', id))
    } catch (error) {
      console.error('Failed to delete recommender:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  return { recommenders, loading, init, add, update, remove }
})
