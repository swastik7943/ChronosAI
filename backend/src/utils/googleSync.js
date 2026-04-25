import { google } from 'googleapis';
import moment from 'moment-timezone';
import User from '../models/User.model.js';
import { encrypt, decrypt } from './encryption.js';

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

// Create OAuth2 client with automatic token refresh
async function getAuthenticatedClient(user) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${backendUrl}/api/auth/google/callback`
  );

  oauth2Client.setCredentials({
    access_token: decrypt(user.googleAccessToken),
    refresh_token: decrypt(user.googleRefreshToken)
  });

  // Listen for token refresh events and persist new tokens
  oauth2Client.on('tokens', async (tokens) => {
    try {
      const updates = {};
      if (tokens.access_token) updates.googleAccessToken = encrypt(tokens.access_token);
      if (tokens.refresh_token) updates.googleRefreshToken = encrypt(tokens.refresh_token);

      if (Object.keys(updates).length > 0) {
        await User.findByIdAndUpdate(user._id, updates);
        console.log('Google OAuth tokens refreshed and saved.');
      }
    } catch (err) {
      console.error('Failed to save refreshed tokens:', err.message);
    }
  });

  // Force a token refresh if the access token might be expired
  // Google tokens expire in 1 hour — proactively refresh
  try {
    const tokenInfo = oauth2Client.credentials;
    const expiryDate = tokenInfo.expiry_date;

    // If no expiry date or token expires within 5 minutes, force refresh
    if (!expiryDate || expiryDate < Date.now() + 5 * 60 * 1000) {
      if (user.googleRefreshToken) {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);

        // Persist the refreshed token
        await User.findByIdAndUpdate(user._id, {
          googleAccessToken: encrypt(credentials.access_token),
          ...(credentials.refresh_token && { googleRefreshToken: encrypt(credentials.refresh_token) })
        });
        console.log('Proactively refreshed Google access token.');
      }
    }
  } catch (refreshErr) {
    console.error('Token refresh failed:', refreshErr.message);
    // Continue anyway — the request might still work
  }

  return oauth2Client;
}

export const syncWithGoogleCalendar = async (user, meeting, action = 'insert') => {
  if (!user.googleAccessToken) return;

  try {
    const oauth2Client = await getAuthenticatedClient(user);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const userTz = resolveTimezone(user.timezone || 'UTC');

    const startMoment = moment.tz(`${meeting.date}T${meeting.startTime}`, userTz);
    const endMoment = startMoment.clone().add(meeting.duration, 'minutes');

    if (action === 'insert') {
      const event = {
        summary: meeting.title,
        start: { dateTime: startMoment.format(), timeZone: userTz },
        end: { dateTime: endMoment.format(), timeZone: userTz },
        attendees: meeting.participants?.map(email => ({
          email: email.includes('@') ? email : `${email}@example.com`
        })) || [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 15 },
            { method: 'email', minutes: 15 }
          ]
        }
      };

      const res = await calendar.events.insert({ calendarId: 'primary', requestBody: event });
      console.log('Successfully inserted into Google Calendar.');
      return { success: true, eventId: res.data.id };
    } else if (action === 'update' && meeting.googleEventId) {
      const event = {
        summary: meeting.title,
        start: { dateTime: startMoment.format(), timeZone: userTz },
        end: { dateTime: endMoment.format(), timeZone: userTz },
        attendees: meeting.participants?.map(email => ({
          email: email.includes('@') ? email : `${email}@example.com`
        })) || []
      };

      await calendar.events.update({
        calendarId: 'primary',
        eventId: meeting.googleEventId,
        requestBody: event
      });
      console.log('Successfully updated Google Calendar event.');
      return { success: true };
    } else if (action === 'delete' && meeting.googleEventId) {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: meeting.googleEventId
      });
      console.log('Successfully deleted Google Calendar event.');
      return { success: true };
    }
    return { success: false, error: 'No action taken or missing googleEventId' };
  } catch (error) {
    console.error('Failed to sync with Google Calendar:', error.message);
    return { success: false, error: error.message };
  }
};
