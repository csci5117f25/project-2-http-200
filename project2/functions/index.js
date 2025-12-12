/**
 * Firebase Cloud Functions for scheduled todo reminders
 * 
 * This function runs on a schedule to check and send reminder emails
 * at 8 AM and 8 PM every day.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Scheduled function that runs every hour to check for reminders
 * Only processes at 8 AM and 8 PM
 */
exports.checkTodoReminders = functions.pubsub
  .schedule('0 * * * *') // Run every hour at minute 0
  .timeZone('America/Chicago') // Adjust to your timezone
  .onRun(async (context) => {
    const now = new Date();
    const hour = now.getHours();
    
    // Only process at 8 AM (hour 8) and 8 PM (hour 20)
    if (hour !== 8 && hour !== 20) {
      console.log(`Skipping reminder check - current hour is ${hour}, only processing at 8 AM and 8 PM`);
      return null;
    }
    
    console.log(`Processing reminders at ${hour === 8 ? '8 AM' : '8 PM'}`);
    
    try {
      // Get all users
      const usersSnapshot = await admin.auth().listUsers();
      const users = usersSnapshot.users;
      
      // Get all projects for each user
      for (const user of users) {
        if (!user.email) continue;
        
        const projectsSnapshot = await admin.firestore()
          .collection('projects')
          .where('userId', '==', user.uid)
          .get();
        
        if (projectsSnapshot.empty) continue;
        
        const projects = projectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Get reminder records for this user
        const remindersSnapshot = await admin.firestore()
          .collection('todoReminders')
          .where('userId', '==', user.uid)
          .get();
        
        const reminderMap = new Map();
        remindersSnapshot.forEach(doc => {
          const data = doc.data();
          const key = `${data.projectId}_${data.todoIndex}`;
          reminderMap.set(key, {
            id: doc.id,
            projectId: data.projectId,
            todoIndex: data.todoIndex,
            lastSent: data.lastSent?.toDate(),
            nextSend: data.nextSend?.toDate()
          });
        });
        
        // Check each project's todos
        for (const project of projects) {
          if (!project.todos || !Array.isArray(project.todos)) continue;
          
          for (let i = 0; i < project.todos.length; i++) {
            const todo = project.todos[i];
            if (!todo.task || !todo.time || !todo.frequency) continue;
            if (todo.state === 'Finished') continue;
            
            const key = `${project.id}_${i}`;
            const reminderRecord = reminderMap.get(key);
            
            // Import reminder check logic
            const shouldSend = await checkShouldSendReminder(
              todo.time,
              todo.frequency,
              reminderRecord?.lastSent,
              hour
            );
            
            if (shouldSend) {
              // Send reminder email
              await sendReminderEmail(user.email, {
                task: todo.task,
                deadline: todo.time,
                frequency: todo.frequency,
                state: todo.state
              });
              
              // Update reminder record
              const nextSend = calculateNextReminderTime(todo.time, todo.frequency);
              
              if (reminderRecord) {
                await admin.firestore()
                  .collection('todoReminders')
                  .doc(reminderRecord.id)
                  .update({
                    lastSent: admin.firestore.FieldValue.serverTimestamp(),
                    nextSend: nextSend
                  });
              } else {
                await admin.firestore()
                  .collection('todoReminders')
                  .add({
                    projectId: project.id,
                    todoIndex: i,
                    userId: user.uid,
                    lastSent: admin.firestore.FieldValue.serverTimestamp(),
                    nextSend: nextSend
                  });
              }
              
              console.log(`Sent reminder for task "${todo.task}" to ${user.email}`);
            }
          }
        }
      }
      
      console.log('Reminder check completed successfully');
      return null;
    } catch (error) {
      console.error('Error checking reminders:', error);
      return null;
    }
  });

/**
 * Helper function to check if reminder should be sent
 */
async function checkShouldSendReminder(deadline, frequency, lastSent, currentHour) {
  if (!deadline) return false;
  
  // Parse deadline (MM/DD/YYYY)
  const parts = deadline.split('/');
  if (parts.length !== 3) return false;
  
  const month = parseInt(parts[0]) - 1;
  const day = parseInt(parts[1]);
  const year = parseInt(parts[2]);
  
  const deadlineDate = new Date(year, month, day);
  deadlineDate.setHours(23, 59, 59, 999);
  
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const hoursUntil = diffMs / (1000 * 60 * 60);
  
  if (daysUntil < 0) return false;
  
  const isMorning = currentHour === 8;
  const isEvening = currentHour === 20;
  
  if (!isMorning && !isEvening) return false;
  
  switch (frequency) {
    case 'High':
      if (daysUntil >= 7) {
        // Daily (morning only)
        if (!isMorning) return false;
        if (!lastSent) return true;
        const lastSentDate = lastSent.toDate ? lastSent.toDate() : new Date(lastSent);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lastSentDay = new Date(lastSentDate.getFullYear(), lastSentDate.getMonth(), lastSentDate.getDate());
        return today.getTime() !== lastSentDay.getTime();
      } else if (daysUntil >= 2 && daysUntil < 7) {
        // Twice daily (8 AM + 8 PM)
        if (!lastSent) return true;
        const lastSentDate = lastSent.toDate ? lastSent.toDate() : new Date(lastSent);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lastSentDay = new Date(lastSentDate.getFullYear(), lastSentDate.getMonth(), lastSentDate.getDate());
        const lastSentHour = lastSentDate.getHours();
        
        if (today.getTime() === lastSentDay.getTime()) {
          return (isMorning && lastSentHour !== 8) || (isEvening && lastSentHour !== 20);
        }
        return true;
      } else if (hoursUntil <= 48) {
        // Every 12 hours
        if (!lastSent) return true;
        const lastSentDate = lastSent.toDate ? lastSent.toDate() : new Date(lastSent);
        const hoursSinceLastSent = (now.getTime() - lastSentDate.getTime()) / (1000 * 60 * 60);
        return hoursSinceLastSent >= 12;
      }
      return false;
      
    case 'Medium':
      if (daysUntil >= 7) {
        // Twice weekly (Monday/Thursday at 8 AM)
        if (!isMorning) return false;
        const dayOfWeek = now.getDay();
        if (dayOfWeek === 1 || dayOfWeek === 4) {
          if (!lastSent) return true;
          const lastSentDate = lastSent.toDate ? lastSent.toDate() : new Date(lastSent);
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const lastSentDay = new Date(lastSentDate.getFullYear(), lastSentDate.getMonth(), lastSentDate.getDate());
          return today.getTime() !== lastSentDay.getTime();
        }
        return false;
      } else if (daysUntil >= 2 && daysUntil < 7) {
        // Daily (morning at 8 AM)
        if (!isMorning) return false;
        if (!lastSent) return true;
        const lastSentDate = lastSent.toDate ? lastSent.toDate() : new Date(lastSent);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lastSentDay = new Date(lastSentDate.getFullYear(), lastSentDate.getMonth(), lastSentDate.getDate());
        return today.getTime() !== lastSentDay.getTime();
      } else if (hoursUntil <= 48) {
        // Every 12 hours
        if (!lastSent) return true;
        const lastSentDate = lastSent.toDate ? lastSent.toDate() : new Date(lastSent);
        const hoursSinceLastSent = (now.getTime() - lastSentDate.getTime()) / (1000 * 60 * 60);
        return hoursSinceLastSent >= 12;
      }
      return false;
      
    case 'Low':
      if (daysUntil >= 14) {
        // Weekly (Monday at 8 AM)
        if (!isMorning) return false;
        const dayOfWeek = now.getDay();
        if (dayOfWeek === 1) {
          if (!lastSent) return true;
          const lastSentDate = lastSent.toDate ? lastSent.toDate() : new Date(lastSent);
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const lastSentDay = new Date(lastSentDate.getFullYear(), lastSentDate.getMonth(), lastSentDate.getDate());
          return today.getTime() !== lastSentDay.getTime();
        }
        return false;
      } else if (daysUntil >= 3 && daysUntil < 14) {
        // Twice weekly (Monday/Thursday at 8 AM)
        if (!isMorning) return false;
        const dayOfWeek = now.getDay();
        if (dayOfWeek === 1 || dayOfWeek === 4) {
          if (!lastSent) return true;
          const lastSentDate = lastSent.toDate ? lastSent.toDate() : new Date(lastSent);
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const lastSentDay = new Date(lastSentDate.getFullYear(), lastSentDate.getMonth(), lastSentDate.getDate());
          return today.getTime() !== lastSentDay.getTime();
        }
        return false;
      } else if (hoursUntil <= 72) {
        // Daily (morning at 8 AM)
        if (!isMorning) return false;
        if (!lastSent) return true;
        const lastSentDate = lastSent.toDate ? lastSent.toDate() : new Date(lastSent);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lastSentDay = new Date(lastSentDate.getFullYear(), lastSentDate.getMonth(), lastSentDate.getDate());
        return today.getTime() !== lastSentDay.getTime();
      }
      return false;
      
    default:
      return false;
  }
}

/**
 * Calculate next reminder time
 */
function calculateNextReminderTime(deadline, frequency) {
  if (!deadline) return null;
  
  const parts = deadline.split('/');
  if (parts.length !== 3) return null;
  
  const month = parseInt(parts[0]) - 1;
  const day = parseInt(parts[1]);
  const year = parseInt(parts[2]);
  
  const deadlineDate = new Date(year, month, day);
  deadlineDate.setHours(23, 59, 59, 999);
  
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const hoursUntil = diffMs / (1000 * 60 * 60);
  
  if (daysUntil < 0) return null;
  
  const nextReminder = new Date(now);
  const currentHour = now.getHours();
  
  switch (frequency) {
    case 'High':
      if (daysUntil >= 7) {
        nextReminder.setHours(8, 0, 0, 0);
        if (nextReminder.getTime() <= now.getTime()) {
          nextReminder.setDate(nextReminder.getDate() + 1);
        }
      } else if (daysUntil >= 2 && daysUntil < 7) {
        if (currentHour < 8) {
          nextReminder.setHours(8, 0, 0, 0);
        } else if (currentHour < 20) {
          nextReminder.setHours(20, 0, 0, 0);
        } else {
          nextReminder.setDate(nextReminder.getDate() + 1);
          nextReminder.setHours(8, 0, 0, 0);
        }
      } else if (hoursUntil <= 48) {
        if (currentHour < 8) {
          nextReminder.setHours(8, 0, 0, 0);
        } else if (currentHour < 20) {
          nextReminder.setHours(20, 0, 0, 0);
        } else {
          nextReminder.setDate(nextReminder.getDate() + 1);
          nextReminder.setHours(8, 0, 0, 0);
        }
      }
      break;
      
    case 'Medium':
      if (daysUntil >= 7) {
        const dayOfWeek = now.getDay();
        let daysToAdd = 0;
        if (dayOfWeek === 0) daysToAdd = 1;
        else if (dayOfWeek < 4) daysToAdd = 4 - dayOfWeek;
        else if (dayOfWeek === 4) {
          if (currentHour < 8) daysToAdd = 0;
          else daysToAdd = 3;
        } else daysToAdd = (8 - dayOfWeek) % 7 || 7;
        nextReminder.setDate(nextReminder.getDate() + daysToAdd);
        nextReminder.setHours(8, 0, 0, 0);
      } else if (daysUntil >= 2 && daysUntil < 7) {
        nextReminder.setHours(8, 0, 0, 0);
        if (nextReminder.getTime() <= now.getTime()) {
          nextReminder.setDate(nextReminder.getDate() + 1);
        }
      } else if (hoursUntil <= 48) {
        if (currentHour < 8) {
          nextReminder.setHours(8, 0, 0, 0);
        } else if (currentHour < 20) {
          nextReminder.setHours(20, 0, 0, 0);
        } else {
          nextReminder.setDate(nextReminder.getDate() + 1);
          nextReminder.setHours(8, 0, 0, 0);
        }
      }
      break;
      
    case 'Low':
      if (daysUntil >= 14) {
        const dayOfWeek = now.getDay();
        let daysToAdd = 0;
        if (dayOfWeek === 0) daysToAdd = 1;
        else if (dayOfWeek === 1) {
          if (currentHour < 8) daysToAdd = 0;
          else daysToAdd = 7;
        } else {
          daysToAdd = (8 - dayOfWeek) % 7 || 7;
        }
        nextReminder.setDate(nextReminder.getDate() + daysToAdd);
        nextReminder.setHours(8, 0, 0, 0);
      } else if (daysUntil >= 3 && daysUntil < 14) {
        const dayOfWeek = now.getDay();
        let daysToAdd = 0;
        if (dayOfWeek === 0) daysToAdd = 1;
        else if (dayOfWeek < 4) {
          if (dayOfWeek === 1 && currentHour < 8) daysToAdd = 0;
          else daysToAdd = 4 - dayOfWeek;
        } else if (dayOfWeek === 4) {
          if (currentHour < 8) daysToAdd = 0;
          else daysToAdd = 3;
        } else {
          daysToAdd = (8 - dayOfWeek) % 7 || 7;
        }
        nextReminder.setDate(nextReminder.getDate() + daysToAdd);
        nextReminder.setHours(8, 0, 0, 0);
      } else if (hoursUntil <= 72) {
        nextReminder.setHours(8, 0, 0, 0);
        if (nextReminder.getTime() <= now.getTime()) {
          nextReminder.setDate(nextReminder.getDate() + 1);
        }
      }
      break;
  }
  
  return nextReminder.getTime() > now.getTime() ? admin.firestore.Timestamp.fromDate(nextReminder) : null;
}

/**
 * Send reminder email via Firestore mail collection (Trigger Email extension)
 */
async function sendReminderEmail(userEmail, todo) {
  const parts = todo.deadline.split('/');
  if (parts.length !== 3) return;
  
  const year = parseInt(parts[2]);
  const month = parseInt(parts[0]) - 1;
  const day = parseInt(parts[1]);
  
  const deadlineDate = new Date(year, month, day);
  const deadlineStr = deadlineDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  const urgencyText = daysUntil >= 7 ? 'approaching' : daysUntil >= 2 ? 'coming up soon' : 'due very soon';
  const frequencyText = todo.frequency === 'High' ? 'high priority' : todo.frequency === 'Medium' ? 'medium priority' : 'low priority';
  
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #ff6b6b;">Task Reminder: ${todo.task}</h2>
  <p>Dear Applicant,</p>
  <p>This is a reminder about a task in your PhD application tracking system.</p>
  
  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Task:</strong> ${todo.task}</p>
    <p style="margin: 5px 0;"><strong>Deadline:</strong> ${deadlineStr}</p>
    <p style="margin: 5px 0;"><strong>Priority:</strong> ${frequencyText}</p>
    <p style="margin: 5px 0;"><strong>Status:</strong> ${todo.state}</p>
    <p style="margin: 5px 0;"><strong>Days Remaining:</strong> ${daysUntil >= 0 ? daysUntil : 'Overdue'}</p>
  </div>
  
  <p>This task is ${urgencyText}. Please make sure to complete it before the deadline.</p>
  
  <p style="text-align: center; margin: 30px 0;">
    <a href="${process.env.APP_URL || 'https://your-app-url.com'}/home" style="background-color: #ff6b6b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Dashboard</a>
  </p>
  
  <p>Best regards,<br/><strong>PhD App Hub</strong></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="font-size: 12px; color: #999;">This is an automated reminder from PhD App Hub. Please do not reply to this email.</p>
</body>
</html>`;
  
  const textContent = `Task Reminder: ${todo.task}

Dear Applicant,

This is a reminder about a task in your PhD application tracking system.

Task: ${todo.task}
Deadline: ${deadlineStr}
Priority: ${frequencyText}
Status: ${todo.state}
Days Remaining: ${daysUntil >= 0 ? daysUntil : 'Overdue'}

This task is ${urgencyText}. Please make sure to complete it before the deadline.

View your dashboard: ${process.env.APP_URL || 'https://your-app-url.com'}/home

Best regards,
PhD App Hub

This is an automated reminder from PhD App Hub. Please do not reply to this email.`;
  
  await admin.firestore().collection('mail').add({
    to: userEmail,
    message: {
      subject: `Reminder: ${todo.task} - Due ${deadlineStr}`,
      html: htmlContent,
      text: textContent
    }
  });
}
