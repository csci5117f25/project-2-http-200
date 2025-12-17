import { defineStore } from 'pinia'
import { ref } from 'vue'
import { 
  collection, 
  addDoc
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './auth'

export interface MailTask {
  to: string
  message: {
    subject: string
    html: string
    text: string
  }
  from?: string
  createdAt?: any
}

export const useMail = defineStore('mail', () => {
  const loading = ref(false)
  const auth = useAuth()
  
  const sendInvitationEmail = async (
    to: string,
    recommenderName: string,
    studentName: string,
    tokenId: string,
    schools: Array<{ name: string; deadline?: Date | string; portalUrl?: string }>
  ) => {
    if (!auth.user?.uid) {
      throw new Error('User not logged in')
    }
    
    try {
      loading.value = true
      
      const baseUrl = window.location.origin
      const invitationUrl = `${baseUrl}/professor/invite/${tokenId}`
      
      const schoolsList = schools.map(school => {
        const deadline = school.deadline 
          ? new Date(school.deadline).toLocaleDateString() 
          : 'TBD'
        return `
          <li>
            <strong>${school.name}</strong><br/>
            Deadline: ${deadline}<br/>
            ${school.portalUrl ? `<a href="${school.portalUrl}">Portal Link</a>` : ''}
          </li>
        `
      }).join('')
      
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #ff6b6b;">Recommendation Letter Request</h2>
  <p>Dear Prof. ${recommenderName},</p>
  <p>I hope this email finds you well. I am writing to request recommendation letters for my PhD applications.</p>
  <p>I would be grateful if you could write recommendation letters for the following programs:</p>
  <ul style="padding-left: 20px;">
    ${schoolsList}
  </ul>
  <p>You can access the recommendation letter management system and update the status of each letter through the following link:</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="${invitationUrl}" style="background-color: #ff6b6b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Access Recommendation Portal</a>
  </p>
  <p>Thank you very much for your time and support.</p>
  <p>Best regards,<br/><strong>${studentName}</strong></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="font-size: 12px; color: #999;">This is an automated email from PhD App Hub. Please do not reply to this email.</p>
</body>
</html>`
      
      const textContent = `
Recommendation Letter Request

Dear Prof. ${recommenderName},

I hope this email finds you well. I am writing to request recommendation letters for my PhD applications.

I would be grateful if you could write recommendation letters for the following programs:

${schools.map(s => `- ${s.name} (Deadline: ${s.deadline ? new Date(s.deadline).toLocaleDateString() : 'TBD'})`).join('\n')}

You can access the recommendation letter management system through this link:
${invitationUrl}

Thank you very much for your time and support.

Best regards,
${studentName}
      `
      
      // Trigger Email extension format - minimal required fields
      // The extension is configured to use chenh7387@gmail.com as the default sender
      // Format must match exactly what the extension expects
      const mailTask = {
        to, // Recipient email (recommender's email)
        message: {
          subject: `Recommendation Letter Request from ${studentName}`,
          html: htmlContent,
          text: textContent
        }
        // Don't include 'from' or 'createdAt' - let extension handle these
      }
      
      // Add to mail collection - Trigger Email extension will automatically send the email
      const docRef = await addDoc(collection(db, 'mail'), mailTask)
      
      // Return the document ID for tracking
      return docRef.id
      
    } catch (error) {
      throw error
    } finally {
      loading.value = false
    }
  }
  
  // Check email sending status (optional - for tracking)
  const checkEmailStatus = async (mailId: string) => {
    try {
      const { doc, getDoc } = await import('firebase/firestore')
      const mailDoc = await getDoc(doc(db, 'mail', mailId))
      if (mailDoc.exists()) {
        const data = mailDoc.data()
        const status = {
          sent: data.sent || false,
          error: data.error || null,
          sentAt: data.sentAt || null,
          delivery: data.delivery || null,
          message: data.message || null
        }
        console.log('Email status for', mailId, ':', status)
        return status
      }
      console.warn('Mail document not found:', mailId)
      return null
    } catch (error) {
      console.error('Failed to check email status:', error)
      return null
    }
  }
  
  return { loading, sendInvitationEmail, checkEmailStatus }
})

