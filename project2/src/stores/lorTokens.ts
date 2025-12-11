import { defineStore } from 'pinia'
import { ref } from 'vue'
import { 
  collection,
  updateDoc, 
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './auth'

export interface LORInvitationToken {
  id?: string
  userId: string
  userEmail?: string  // Store student's email for professor access
  recommenderId: string
  active: boolean
  expiresAt?: Date | Timestamp
  createdAt?: Date
}

export const useLORTokens = defineStore('lorTokens', () => {
  const loading = ref(false)
  const auth = useAuth()
  
  const generateToken = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return token
  }
  
  const getOrCreateToken = async (recommenderId: string): Promise<string> => {
    if (!auth.user?.uid) {
      throw new Error('User not logged in')
    }
    
    try {
      loading.value = true
      
      // Check for existing active token
      const tokensRef = collection(db, 'lorInvitationTokens')
      const q = query(
        tokensRef,
        where('userId', '==', auth.user.uid),
        where('recommenderId', '==', recommenderId),
        where('active', '==', true)
      )
      
      const snapshot = await getDocs(q)
      
      if (!snapshot.empty) {
        const existingToken = snapshot.docs[0]
        const tokenData = existingToken.data() as LORInvitationToken
        
        // Check if token is expired
        if (tokenData.expiresAt) {
          const expiresAt = tokenData.expiresAt instanceof Timestamp 
            ? tokenData.expiresAt.toDate() 
            : new Date(tokenData.expiresAt)
          
          if (expiresAt > new Date()) {
            return existingToken.id!
          }
        } else {
          return existingToken.id!
        }
      }
      
      // Create new token
      const newTokenId = generateToken()
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + 6) // 6 months expiration
      
      await setDoc(doc(db, 'lorInvitationTokens', newTokenId), {
        userId: auth.user.uid,
        userEmail: auth.user.email || '',  // Store student's Google email
        recommenderId,
        active: true,
        expiresAt,
        createdAt: new Date()
      })
      
      return newTokenId
    } catch (error) {
      console.error('Failed to get or create token:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  const revokeToken = async (tokenId: string) => {
    try {
      loading.value = true
      await updateDoc(doc(db, 'lorInvitationTokens', tokenId), {
        active: false
      })
    } catch (error) {
      console.error('Failed to revoke token:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  const validateToken = async (tokenId: string): Promise<LORInvitationToken | null> => {
    try {
      const tokenDoc = await getDoc(doc(db, 'lorInvitationTokens', tokenId))
      
      if (!tokenDoc.exists()) {
        return null
      }
      
      const tokenData = tokenDoc.data() as LORInvitationToken
      
      if (!tokenData.active) {
        return null
      }
      
      if (tokenData.expiresAt) {
        const expiresAt = tokenData.expiresAt instanceof Timestamp 
          ? tokenData.expiresAt.toDate() 
          : new Date(tokenData.expiresAt)
        
        if (expiresAt <= new Date()) {
          return null
        }
      }
      
      return { id: tokenDoc.id, ...tokenData }
    } catch (error) {
      console.error('Failed to validate token:', error)
      return null
    }
  }
  
  return { loading, getOrCreateToken, revokeToken, validateToken }
})
