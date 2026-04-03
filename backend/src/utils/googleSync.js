import { google } from 'googleapis';

export const syncWithGoogleCalendar = async (user, meeting, action = 'insert') => {
  if (!user.googleAccessToken) return;

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:5000/api/auth/google/callback'
    );
    oauth2Client.setCredentials({ 
      access_token: user.googleAccessToken, 
      refresh_token: user.googleRefreshToken 
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Assume local time, not perfect but works for placeholder
    const startObj = new Date(`${meeting.date}T${meeting.startTime}:00`);
    const endObj = new Date(startObj.getTime() + meeting.duration * 60000);

    if (action === 'insert') {
      const event = {
        summary: meeting.title,
        start: { dateTime: startObj.toISOString() },
        end: { dateTime: endObj.toISOString() },
        attendees: meeting.participants?.map(email => ({ email: email.includes('@') ? email : `${email}@example.com` })) || []
      };

      await calendar.events.insert({ calendarId: 'primary', requestBody: event });
      console.log("Successfully inserted into Google Calendar.");
    }
  } catch (error) {
    console.error('Failed to sync with Google Calendar:', error.message);
  }
};
