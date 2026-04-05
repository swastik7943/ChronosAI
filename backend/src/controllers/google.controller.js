import { google } from 'googleapis';
import User from '../models/User.model.js';
import jwt from 'jsonwebtoken';

const getOAuth2Client = () => {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${backendUrl}/api/auth/google/callback`
    );
}

export const getGoogleAuthUrl = (req, res) => {
  const oauth2Client = getOAuth2Client();

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent' // Forces refresh token generation
  });

  res.json({ url });
};

export const googleCallback = async (req, res) => {
  const { code } = req.query;

  try {
    const oauth2Client = getOAuth2Client();

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user profile
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const { data } = await oauth2.userinfo.get();
    
    let user = await User.findOne({ email: data.email });

    if (!user) {
       user = await User.create({
         name: data.name,
         email: data.email,
         googleId: data.id,
       });
    } else {
       user.googleId = data.id;
    }

    if (tokens.access_token) user.googleAccessToken = tokens.access_token;
    if (tokens.refresh_token) user.googleRefreshToken = tokens.refresh_token;

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'super_secret', { expiresIn: '30d' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}?token=${token}`);
  } catch (error) {
    console.error('Google Callback Error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
};
