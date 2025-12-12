import { collection, query, where, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * Calculate next reminder time based on deadline and frequency
 * This matches the logic from Firebase Cloud Functions
 */
function calculateNextReminderTime(deadline: string, frequency: 'High' | 'Medium' | 'Low'): Date | null {
  if (!deadline) return null
  
  const parts = deadline.split('/')
  if (parts.length !== 3) return null
  
  const monthStr = parts[0]
  const dayStr = parts[1]
  const yearStr = parts[2]
  
  if (!monthStr || !dayStr || !yearStr) return null
  
  const month = parseInt(monthStr) - 1
  const day = parseInt(dayStr)
  const year = parseInt(yearStr)
  
  const deadlineDate = new Date(year, month, day)
  deadlineDate.setHours(23, 59, 59, 999)
  
  const now = new Date()
  const diffMs = deadlineDate.getTime() - now.getTime()
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const hoursUntil = diffMs / (1000 * 60 * 60)
  
  if (daysUntil < 0) return null
  
  const nextReminder = new Date(now)
  const currentHour = now.getHours()
  
  switch (frequency) {
    case 'High':
      if (daysUntil >= 7) {
        nextReminder.setHours(8, 0, 0, 0)
        if (nextReminder.getTime() <= now.getTime()) {
          nextReminder.setDate(nextReminder.getDate() + 1)
        }
      } else if (daysUntil >= 2 && daysUntil < 7) {
        if (currentHour < 8) {
          nextReminder.setHours(8, 0, 0, 0)
        } else if (currentHour < 20) {
          nextReminder.setHours(20, 0, 0, 0)
        } else {
          nextReminder.setDate(nextReminder.getDate() + 1)
          nextReminder.setHours(8, 0, 0, 0)
        }
      } else if (hoursUntil <= 48) {
        if (currentHour < 8) {
          nextReminder.setHours(8, 0, 0, 0)
        } else if (currentHour < 20) {
          nextReminder.setHours(20, 0, 0, 0)
        } else {
          nextReminder.setDate(nextReminder.getDate() + 1)
          nextReminder.setHours(8, 0, 0, 0)
        }
      }
      break
      
    case 'Medium':
      if (daysUntil >= 7) {
        const dayOfWeek = now.getDay()
        let daysToAdd = 0
        if (dayOfWeek === 0) daysToAdd = 1
        else if (dayOfWeek < 4) daysToAdd = 4 - dayOfWeek
        else if (dayOfWeek === 4) {
          if (currentHour < 8) daysToAdd = 0
          else daysToAdd = 3
        } else daysToAdd = (8 - dayOfWeek) % 7 || 7
        nextReminder.setDate(nextReminder.getDate() + daysToAdd)
        nextReminder.setHours(8, 0, 0, 0)
      } else if (daysUntil >= 2 && daysUntil < 7) {
        nextReminder.setHours(8, 0, 0, 0)
        if (nextReminder.getTime() <= now.getTime()) {
          nextReminder.setDate(nextReminder.getDate() + 1)
        }
      } else if (hoursUntil <= 48) {
        if (currentHour < 8) {
          nextReminder.setHours(8, 0, 0, 0)
        } else if (currentHour < 20) {
          nextReminder.setHours(20, 0, 0, 0)
        } else {
          nextReminder.setDate(nextReminder.getDate() + 1)
          nextReminder.setHours(8, 0, 0, 0)
        }
      }
      break
      
    case 'Low':
      if (daysUntil >= 14) {
        const dayOfWeek = now.getDay()
        let daysToAdd = 0
        if (dayOfWeek === 0) daysToAdd = 1
        else if (dayOfWeek === 1) {
          if (currentHour < 8) daysToAdd = 0
          else daysToAdd = 7
        } else {
          daysToAdd = (8 - dayOfWeek) % 7 || 7
        }
        nextReminder.setDate(nextReminder.getDate() + daysToAdd)
        nextReminder.setHours(8, 0, 0, 0)
      } else if (daysUntil >= 3 && daysUntil < 14) {
        const dayOfWeek = now.getDay()
        let daysToAdd = 0
        if (dayOfWeek === 0) daysToAdd = 1
        else if (dayOfWeek < 4) {
          if (dayOfWeek === 1 && currentHour < 8) daysToAdd = 0
          else daysToAdd = 4 - dayOfWeek
        } else if (dayOfWeek === 4) {
          if (currentHour < 8) daysToAdd = 0
          else daysToAdd = 3
        } else {
          daysToAdd = (8 - dayOfWeek) % 7 || 7
        }
        nextReminder.setDate(nextReminder.getDate() + daysToAdd)
        nextReminder.setHours(8, 0, 0, 0)
      } else if (hoursUntil <= 72) {
        nextReminder.setHours(8, 0, 0, 0)
        if (nextReminder.getTime() <= now.getTime()) {
          nextReminder.setDate(nextReminder.getDate() + 1)
        }
      }
      break
  }
  
  return nextReminder.getTime() > now.getTime() ? nextReminder : null
}

/**
 * Update or create a reminder record in Firestore
 * @param projectId - The project ID
 * @param todoIndex - The index of the todo item in the project's todos array
 * @param userId - The user ID
 * @param deadline - The deadline in MM/DD/YYYY format
 * @param frequency - The reminder frequency (High, Medium, Low)
 */
export async function updateReminderRecord(
  projectId: string,
  todoIndex: number,
  userId: string,
  deadline: string,
  frequency: 'High' | 'Medium' | 'Low'
): Promise<void> {
  try {
    // Calculate next reminder time
    const nextSend = calculateNextReminderTime(deadline, frequency)
    
    if (!nextSend) {
      console.warn('Could not calculate next reminder time for deadline:', deadline)
      return
    }
    
    // Find existing reminder record
    const remindersRef = collection(db, 'todoReminders')
    const q = query(
      remindersRef,
      where('projectId', '==', projectId),
      where('todoIndex', '==', todoIndex),
      where('userId', '==', userId)
    )
    
    const querySnapshot = await getDocs(q)
    
    const reminderData = {
      projectId,
      todoIndex,
      userId,
      deadline,
      frequency,
      nextSend: Timestamp.fromDate(nextSend),
      updatedAt: Timestamp.now()
    }
    
    if (!querySnapshot.empty && querySnapshot.docs[0]) {
      // Update existing record
      const docRef = querySnapshot.docs[0].ref
      await setDoc(docRef, reminderData, { merge: true })
    } else {
      // Create new record
      const docRef = doc(remindersRef)
      await setDoc(docRef, {
        ...reminderData,
        createdAt: Timestamp.now(),
        lastSent: null
      })
    }
  } catch (error) {
    console.error('Error updating reminder record:', error)
    // Don't throw - allow the UI to continue even if reminder update fails
  }
}
