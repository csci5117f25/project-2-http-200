import { collection, query, where, getDocs, doc, setDoc, Timestamp, addDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * Calculate next reminder time based on deadline and frequency
 */
function calculateNextReminderTime(deadline: string, frequency: 'High' | 'Medium' | 'Low', baseTime?: Date): Date | null {
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
  
  const now = baseTime || new Date()
  const diffMs = deadlineDate.getTime() - now.getTime()
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const hoursUntil = diffMs / (1000 * 60 * 60)
  
  if (daysUntil < 0) return null
  
  const nextReminder = new Date(now)
  
  switch (frequency) {
    case 'High':
      if (daysUntil >= 7) {
        // Daily (morning at 8 AM)
        nextReminder.setHours(8, 0, 0, 0)
        if (nextReminder.getTime() <= now.getTime()) {
          nextReminder.setDate(nextReminder.getDate() + 1)
        }
      } else if (daysUntil >= 2 && daysUntil < 7) {
        // Twice daily (morning + evening)
        const currentHour = now.getHours()
        if (currentHour < 8) {
          nextReminder.setHours(8, 0, 0, 0)
        } else if (currentHour < 20) {
          nextReminder.setHours(20, 0, 0, 0)
        } else {
          nextReminder.setDate(nextReminder.getDate() + 1)
          nextReminder.setHours(8, 0, 0, 0)
        }
      } else if (hoursUntil <= 48) {
        // Every 6 hours
        nextReminder.setTime(now.getTime() + 6 * 60 * 60 * 1000)
      }
      break
      
    case 'Medium':
      if (daysUntil >= 7) {
        // Twice weekly (Monday/Thursday at 8 AM)
        const dayOfWeek = now.getDay()
        let daysToAdd = 0
        if (dayOfWeek === 0) daysToAdd = 1
        else if (dayOfWeek < 4) daysToAdd = 4 - dayOfWeek
        else if (dayOfWeek === 4) {
          const currentHour = now.getHours()
          if (currentHour < 8) daysToAdd = 0
          else daysToAdd = 3
        } else {
          daysToAdd = (8 - dayOfWeek) % 7 || 7
        }
        nextReminder.setDate(nextReminder.getDate() + daysToAdd)
        nextReminder.setHours(8, 0, 0, 0)
      } else if (daysUntil >= 2 && daysUntil < 7) {
        // Daily (morning at 8 AM)
        nextReminder.setHours(8, 0, 0, 0)
        if (nextReminder.getTime() <= now.getTime()) {
          nextReminder.setDate(nextReminder.getDate() + 1)
        }
      } else if (hoursUntil <= 48) {
        // Every 12 hours
        nextReminder.setTime(now.getTime() + 12 * 60 * 60 * 1000)
      }
      break
      
    case 'Low':
      if (daysUntil >= 14) {
        // Weekly (Monday at 8 AM)
        const dayOfWeek = now.getDay()
        let daysToAdd = 0
        if (dayOfWeek === 0) daysToAdd = 1
        else if (dayOfWeek === 1) {
          const currentHour = now.getHours()
          if (currentHour < 8) daysToAdd = 0
          else daysToAdd = 7
        } else {
          daysToAdd = (8 - dayOfWeek) % 7 || 7
        }
        nextReminder.setDate(nextReminder.getDate() + daysToAdd)
        nextReminder.setHours(8, 0, 0, 0)
      } else if (daysUntil >= 3 && daysUntil < 14) {
        // Twice weekly (Monday/Thursday at 8 AM)
        const dayOfWeek = now.getDay()
        let daysToAdd = 0
        if (dayOfWeek === 0) daysToAdd = 1
        else if (dayOfWeek < 4) {
          if (dayOfWeek === 1) {
            const currentHour = now.getHours()
            if (currentHour < 8) daysToAdd = 0
            else daysToAdd = 4 - dayOfWeek
          } else {
            daysToAdd = 4 - dayOfWeek
          }
        } else if (dayOfWeek === 4) {
          const currentHour = now.getHours()
          if (currentHour < 8) daysToAdd = 0
          else daysToAdd = 3
        } else {
          daysToAdd = (8 - dayOfWeek) % 7 || 7
        }
        nextReminder.setDate(nextReminder.getDate() + daysToAdd)
        nextReminder.setHours(8, 0, 0, 0)
      } else if (hoursUntil <= 72) {
        // Daily (morning at 8 AM)
        nextReminder.setHours(8, 0, 0, 0)
        if (nextReminder.getTime() <= now.getTime()) {
          nextReminder.setDate(nextReminder.getDate() + 1)
        }
      }
      break
  }
  
  // Ensure next reminder is before deadline
  if (nextReminder.getTime() > deadlineDate.getTime()) return null
  
  return nextReminder.getTime() > now.getTime() ? nextReminder : null
}

/**
 * Check if reminder should be sent immediately (for new/updated todos)
 */
function shouldSendImmediateReminder(deadline: string, frequency: 'High' | 'Medium' | 'Low'): boolean {
  if (!deadline) return false
  
  const parts = deadline.split('/')
  if (parts.length !== 3) return false
  
  const monthStr = parts[0] || ''
  const dayStr = parts[1] || ''
  const yearStr = parts[2] || ''
  
  if (!monthStr || !dayStr || !yearStr) return false
  
  const month = parseInt(monthStr, 10) - 1
  const day = parseInt(dayStr, 10)
  const year = parseInt(yearStr, 10)
  
  const deadlineDate = new Date(year, month, day)
  deadlineDate.setHours(23, 59, 59, 999)
  
  const now = new Date()
  const diffMs = deadlineDate.getTime() - now.getTime()
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const hoursUntil = diffMs / (1000 * 60 * 60)
  
  // Don't send if deadline has passed
  if (daysUntil < 0) return false
  
  // Check if current time matches any immediate send condition
  switch (frequency) {
    case 'High':
      if (hoursUntil <= 48) return true // ≤48h: immediate
      if (daysUntil < 7) return true // 7-2 days: immediate if morning/evening
      return false
      
    case 'Medium':
      if (hoursUntil <= 48) return true // ≤48h: immediate
      if (daysUntil < 7) return true // 7-2 days: immediate
      return false
      
    case 'Low':
      if (hoursUntil <= 72) return true // ≤72h: immediate
      return false
      
    default:
      return false
  }
}

/**
 * Send immediate reminder email if conditions are met
 */
async function sendImmediateReminderEmail(
  userEmail: string,
  task: string,
  deadline: string
): Promise<void> {
  try {
    const parts = deadline.split('/')
    if (parts.length !== 3) return
    
    const monthStr = parts[0] || ''
    const dayStr = parts[1] || ''
    const yearStr = parts[2] || ''
    
    if (!monthStr || !dayStr || !yearStr) return
    
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10) - 1
    const day = parseInt(dayStr, 10)
    
    const deadlineDate = new Date(year, month, day)
    const deadlineStr = deadlineDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    
    const now = new Date()
    const diffMs = deadlineDate.getTime() - now.getTime()
    const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    
    const urgencyColor = daysUntil < 0 ? '#ef4444' : daysUntil <= 2 ? '#f59e0b' : daysUntil <= 7 ? '#3b82f6' : '#10b981'
    const urgencyText = daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Due Today' : daysUntil === 1 ? 'Due Tomorrow' : `${daysUntil} Days Left`
    
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%); padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">📋 Task Reminder</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <div style="margin-bottom: 24px;">
                <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 20px; font-weight: 600; line-height: 1.4;">${task}</h2>
              </div>
              
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid ${urgencyColor};">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom: 12px;">
                      <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Deadline</p>
                      <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px; font-weight: 500;">${deadlineStr}</p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Time Remaining</p>
                      <p style="margin: 4px 0 0 0; color: ${urgencyColor}; font-size: 18px; font-weight: 700;">${urgencyText}</p>
                    </td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #9ca3af; font-size: 12px;">PhD App Hub</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
    
    const textContent = `Task Reminder: ${task}

Deadline: ${deadlineStr}
Time Remaining: ${urgencyText}

PhD App Hub`
    
    await addDoc(collection(db, 'mail'), {
      to: userEmail,
      message: {
        subject: `Reminder: ${task}`,
        html: htmlContent,
        text: textContent
      }
    })
  } catch (error) {
    console.error('Error sending immediate reminder email:', error)
  }
}

/**
 * Update or create a reminder record in Firestore
 */
export async function updateReminderRecord(
  projectId: string,
  todoIndex: number,
  userId: string,
  deadline: string,
  frequency: 'High' | 'Medium' | 'Low',
  userEmail?: string,
  task?: string
): Promise<void> {
  try {
    const now = new Date()
    
    // Check if should send immediate reminder
    const sendImmediate = shouldSendImmediateReminder(deadline, frequency)
    if (sendImmediate && userEmail && task) {
      await sendImmediateReminderEmail(userEmail, task, deadline)
    }
    
    // Calculate next reminder time (starting from now)
    const nextSend = calculateNextReminderTime(deadline, frequency, now)
    
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
        lastSent: sendImmediate ? Timestamp.now() : null
      })
    }
  } catch (error) {
    console.error('Error updating reminder record:', error)
    // Don't throw - allow the UI to continue even if reminder update fails
  }
}
