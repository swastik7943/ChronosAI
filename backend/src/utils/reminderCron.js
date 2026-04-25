import cron from 'node-cron';
import Meeting from '../models/Meeting.model.js';
import User from '../models/User.model.js';
import { sendEmail } from '../utils/sendEmail.js';
import moment from 'moment-timezone';

const TZ_MAP = {
  'UTC': 'UTC', 'GMT': 'Europe/London',
  'EST': 'America/New_York', 'CST': 'America/Chicago',
  'MST': 'America/Denver', 'PST': 'America/Los_Angeles',
  'IST': 'Asia/Kolkata', 'CET': 'Europe/Paris',
  'JST': 'Asia/Tokyo', 'AEST': 'Australia/Sydney'
};

function resolveTimezone(tz) {
  return TZ_MAP[tz] || tz || 'UTC';
}

function formatTime12(time24) {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Track which meetings we've already sent reminders for (in-memory set)
const sentReminders = new Set();

// Clean up old entries every hour to prevent memory leak
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
  for (const key of sentReminders) {
    const ts = parseInt(key.split(':')[1]);
    if (ts && ts < cutoff) sentReminders.delete(key);
  }
}, 60 * 60 * 1000);

async function checkUpcomingMeetings() {
  try {
    const now = moment.utc();
    const todayStr = now.format('YYYY-MM-DD');
    // Also check tomorrow in case it's near midnight UTC
    const tomorrowStr = now.clone().add(1, 'day').format('YYYY-MM-DD');

    const meetings = await Meeting.find({
      date: { $in: [todayStr, tomorrowStr] },
      status: 'scheduled'
    }).populate('organizer', 'name email timezone');

    for (const meeting of meetings) {
      const reminderKey = `${meeting._id}:${meeting.date}T${meeting.startTime}`;
      if (sentReminders.has(reminderKey)) continue;

      const organizer = meeting.organizer;
      if (!organizer) continue;

      const userTz = resolveTimezone(organizer.timezone || 'UTC');
      const meetingStart = moment.tz(`${meeting.date}T${meeting.startTime}`, userTz);
      const nowInUserTz = moment().tz(userTz);

      const minutesUntil = meetingStart.diff(nowInUserTz, 'minutes');

      // Send reminder if meeting is 15 minutes away (window: 10-16 minutes)
      if (minutesUntil >= 10 && minutesUntil <= 16) {
        sentReminders.add(reminderKey);

        console.log(`🔔 Reminder: "${meeting.title}" starts in ~${minutesUntil} min for ${organizer.email}`);

        // Pre-build participant names and organizer details
        let formattedParticipantsStr = 'None';
        const participantEmails = meeting.participants?.filter(p => p.includes('@')) || [];
        if (participantEmails.length > 0) {
          const userDocs = await User.find({ email: { $in: participantEmails } });
          formattedParticipantsStr = participantEmails.map(email => {
            const u = userDocs.find(x => x.email === email);
            return u ? `${u.name} (${u.email})` : email;
          }).join(', ');
        }
        const organizerStr = organizer ? `${organizer.name || 'Unknown'} (${organizer.email})` : 'Unknown';

        // Send email to organizer
        if (process.env.SMTP_USER) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 20px;">
              <h2 style="color: #4F46E5;">⏰ Meeting Reminder</h2>
              <p style="font-size: 16px;">Your meeting <b>${meeting.title}</b> starts in <b>~${minutesUntil} minutes</b>!</p>
              <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
                <tr><td style="padding: 8px; font-weight: bold;">👑 Organizer</td><td style="padding: 8px;">${organizerStr}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">📆 Date</td><td style="padding: 8px;">${meeting.date}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">🕐 Time</td><td style="padding: 8px;">${formatTime12(meeting.startTime)} (${organizer.timezone || 'UTC'})</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">⏱ Duration</td><td style="padding: 8px;">${meeting.duration} min</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">👥 Participants</td><td style="padding: 8px;">${formattedParticipantsStr}</td></tr>
              </table>
              ${meeting.jitsiRoom ? `<p><a href="${frontendUrl}/meet/${meeting.jitsiRoom}" style="background: #4F46E5; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Join Video Call</a></p>` : ''}
              <p style="color: #888; font-size: 12px; margin-top: 20px;">ChronosAI Automated Reminder</p>
            </div>`;

          try {
            await sendEmail({
              to: organizer.email,
              subject: `⏰ Reminder: ${meeting.title} in ${minutesUntil} min`,
              html: emailHtml
            });

            // Also notify participants
            if (participantEmails.length > 0) {
              await sendEmail({
                to: participantEmails.join(', '),
                subject: `⏰ Reminder: ${meeting.title} in ${minutesUntil} min`,
                html: emailHtml
              });
            }
          } catch (emailErr) {
            console.error('Reminder email error:', emailErr.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('Reminder cron error:', error.message);
  }
}

export function startReminderCron() {
  // Run every minute to check for upcoming meetings
  cron.schedule('* * * * *', () => {
    checkUpcomingMeetings();
  });

  console.log('🔔 Meeting reminder cron job started (checks every minute)');
}
