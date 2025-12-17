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
 */
exports.checkTodoReminders = functions.pubsub
  .schedule('0 * * * *') // Run every hour at minute 0
  .timeZone('America/Chicago') // Adjust to your timezone
  .onRun(async (context) => {
    const now = new Date();
    console.log(`Processing reminders at ${now.toISOString()}`);
    
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
            
            // Check if reminder should be sent based on nextSend time
            const shouldSend = checkShouldSendReminder(
              todo.time,
              todo.frequency,
              reminderRecord?.nextSend?.toDate(),
              now
            );
            
            if (shouldSend) {
              // Send reminder email
              await sendReminderEmail(user.email, {
                task: todo.task,
                deadline: todo.time,
                frequency: todo.frequency,
                state: todo.state
              });
              
              // Calculate next reminder time
              const nextSend = calculateNextReminderTime(todo.time, todo.frequency, now);
              
              if (reminderRecord) {
                await admin.firestore()
                  .collection('todoReminders')
                  .doc(reminderRecord.id)
                  .update({
                    lastSent: admin.firestore.FieldValue.serverTimestamp(),
                    nextSend: nextSend ? admin.firestore.Timestamp.fromDate(nextSend) : null
                  });
              } else {
                await admin.firestore()
                  .collection('todoReminders')
                  .add({
                    projectId: project.id,
                    todoIndex: i,
                    userId: user.uid,
                    lastSent: admin.firestore.FieldValue.serverTimestamp(),
                    nextSend: nextSend ? admin.firestore.Timestamp.fromDate(nextSend) : null
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
 * Check if reminder should be sent based on nextSend time
 */
function checkShouldSendReminder(deadline, frequency, nextSend, now) {
  if (!deadline || !nextSend) return false;
  
  // Parse deadline (MM/DD/YYYY)
  const parts = deadline.split('/');
  if (parts.length !== 3) return false;
  
  const month = parseInt(parts[0]) - 1;
  const day = parseInt(parts[1]);
  const year = parseInt(parts[2]);
  
  const deadlineDate = new Date(year, month, day);
  deadlineDate.setHours(23, 59, 59, 999);
  
  // Check if deadline has passed
  if (deadlineDate.getTime() < now.getTime()) return false;
  
  // Convert nextSend to Date if it's a Firestore Timestamp
  const nextSendDate = nextSend.toDate ? nextSend.toDate() : new Date(nextSend);
  
  // Send if current time is >= nextSend time
  return now.getTime() >= nextSendDate.getTime();
}

/**
 * Calculate next reminder time based on deadline and frequency
 */
function calculateNextReminderTime(deadline, frequency, baseTime) {
  if (!deadline) return null;
  
  const parts = deadline.split('/');
  if (parts.length !== 3) return null;
  
  const month = parseInt(parts[0]) - 1;
  const day = parseInt(parts[1]);
  const year = parseInt(parts[2]);
  
  const deadlineDate = new Date(year, month, day);
  deadlineDate.setHours(23, 59, 59, 999);
  
  const now = baseTime || new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const hoursUntil = diffMs / (1000 * 60 * 60);
  
  // Return null if deadline has passed
  if (daysUntil < 0) return null;
  
  const nextReminder = new Date(now);
  
  switch (frequency) {
    case 'High':
      if (daysUntil >= 7) {
        // Daily (morning at 8 AM)
        nextReminder.setHours(8, 0, 0, 0);
        if (nextReminder.getTime() <= now.getTime()) {
          nextReminder.setDate(nextReminder.getDate() + 1);
        }
      } else if (daysUntil >= 2 && daysUntil < 7) {
        // Twice daily (morning + evening)
        const currentHour = now.getHours();
        if (currentHour < 8) {
          nextReminder.setHours(8, 0, 0, 0);
        } else if (currentHour < 20) {
          nextReminder.setHours(20, 0, 0, 0);
        } else {
          nextReminder.setDate(nextReminder.getDate() + 1);
          nextReminder.setHours(8, 0, 0, 0);
        }
      } else if (hoursUntil <= 48) {
        // Every 6 hours
        nextReminder.setTime(now.getTime() + 6 * 60 * 60 * 1000);
      }
      break;
      
    case 'Medium':
      if (daysUntil >= 7) {
        // Twice weekly (Monday/Thursday at 8 AM)
        const dayOfWeek = now.getDay();
        let daysToAdd = 0;
        if (dayOfWeek === 0) daysToAdd = 1; // Sunday -> Monday
        else if (dayOfWeek < 4) daysToAdd = 4 - dayOfWeek; // Mon/Tue/Wed -> Thursday
        else if (dayOfWeek === 4) {
          // Thursday: if before 8 AM, send today; else next Monday
          const currentHour = now.getHours();
          if (currentHour < 8) daysToAdd = 0;
          else daysToAdd = 3; // Next Monday
        } else {
          // Fri/Sat -> Next Monday
          daysToAdd = (8 - dayOfWeek) % 7 || 7;
        }
        nextReminder.setDate(nextReminder.getDate() + daysToAdd);
        nextReminder.setHours(8, 0, 0, 0);
      } else if (daysUntil >= 2 && daysUntil < 7) {
        // Daily (morning at 8 AM)
        nextReminder.setHours(8, 0, 0, 0);
        if (nextReminder.getTime() <= now.getTime()) {
          nextReminder.setDate(nextReminder.getDate() + 1);
        }
      } else if (hoursUntil <= 48) {
        // Every 12 hours
        nextReminder.setTime(now.getTime() + 12 * 60 * 60 * 1000);
      }
      break;
      
    case 'Low':
      if (daysUntil >= 14) {
        // Weekly (Monday at 8 AM)
        const dayOfWeek = now.getDay();
        let daysToAdd = 0;
        if (dayOfWeek === 0) daysToAdd = 1; // Sunday -> Monday
        else if (dayOfWeek === 1) {
          // Monday: if before 8 AM, send today; else next Monday
          const currentHour = now.getHours();
          if (currentHour < 8) daysToAdd = 0;
          else daysToAdd = 7;
        } else {
          // Tue-Sat -> Next Monday
          daysToAdd = (8 - dayOfWeek) % 7 || 7;
        }
        nextReminder.setDate(nextReminder.getDate() + daysToAdd);
        nextReminder.setHours(8, 0, 0, 0);
      } else if (daysUntil >= 3 && daysUntil < 14) {
        // Twice weekly (Monday/Thursday at 8 AM)
        const dayOfWeek = now.getDay();
        let daysToAdd = 0;
        if (dayOfWeek === 0) daysToAdd = 1; // Sunday -> Monday
        else if (dayOfWeek < 4) {
          // Mon/Tue/Wed -> Thursday (or today if Monday before 8 AM)
          if (dayOfWeek === 1) {
            const currentHour = now.getHours();
            if (currentHour < 8) daysToAdd = 0;
            else daysToAdd = 4 - dayOfWeek;
          } else {
            daysToAdd = 4 - dayOfWeek;
          }
        } else if (dayOfWeek === 4) {
          // Thursday: if before 8 AM, send today; else next Monday
          const currentHour = now.getHours();
          if (currentHour < 8) daysToAdd = 0;
          else daysToAdd = 3; // Next Monday
        } else {
          // Fri/Sat -> Next Monday
          daysToAdd = (8 - dayOfWeek) % 7 || 7;
        }
        nextReminder.setDate(nextReminder.getDate() + daysToAdd);
        nextReminder.setHours(8, 0, 0, 0);
      } else if (hoursUntil <= 72) {
        // Daily (morning at 8 AM)
        nextReminder.setHours(8, 0, 0, 0);
        if (nextReminder.getTime() <= now.getTime()) {
          nextReminder.setDate(nextReminder.getDate() + 1);
        }
      }
      break;
  }
  
  // Ensure next reminder is before deadline
  if (nextReminder.getTime() > deadlineDate.getTime()) return null;
  
  return nextReminder.getTime() > now.getTime() ? nextReminder : null;
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
  
  const urgencyColor = daysUntil < 0 ? '#ef4444' : daysUntil <= 2 ? '#f59e0b' : daysUntil <= 7 ? '#3b82f6' : '#10b981';
  const urgencyText = daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Due Today' : daysUntil === 1 ? 'Due Tomorrow' : `${daysUntil} Days Left`;
  
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
                <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 20px; font-weight: 600; line-height: 1.4;">${todo.task}</h2>
                <p style="margin: 0; color: #6b7280; font-size: 14px;">${todo.frequency} Priority</p>
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
</html>`;
  
  const textContent = `Task Reminder: ${todo.task}

Deadline: ${deadlineStr}
Time Remaining: ${urgencyText}
Priority: ${todo.frequency}

PhD App Hub`;
  
  await admin.firestore().collection('mail').add({
    to: userEmail,
    message: {
      subject: `Reminder: ${todo.task}`,
      html: htmlContent,
      text: textContent
    }
  });
}
