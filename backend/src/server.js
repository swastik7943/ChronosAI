import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

if (process.env.MONGODB_URI) {
  const maskedUri = process.env.MONGODB_URI.replace(/\/\/.*@/, '//****:****@');
  console.log(`Config: Loading database URI: ${maskedUri}`);
}

// Fail-Fast Environment Validation (Production Only)
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI', 'ENCRYPTION_KEY'];
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`ERROR: Missing required environment variables: ${missing.join(', ')}`);
    console.error('Shutting down immediately due to insecure configuration.');
    process.exit(1);
  }
}

import authRoutes from './routes/auth.routes.js';
import meetingRoutes from './routes/meeting.routes.js';
import dialogueRoutes from './routes/dialogue.routes.js';
import userRoutes from './routes/user.routes.js';
import teamRoutes from './routes/team.routes.js';
import contactRoutes from './routes/contact.routes.js';
import apikeyRoutes from './routes/apikey.routes.js';

import { generalLimiter, authLimiter, dialogueLimiter } from './middleware/rateLimiter.js';
import { startReminderCron } from './utils/reminderCron.js';

// Only connect to DB and start server outside of test environment
// Each test file manages its own MongoMemoryServer connection
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

const app = express();

app.use(helmet());
app.use(mongoSanitize());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Apply rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', generalLimiter, userRoutes);
app.use('/api/meetings', generalLimiter, meetingRoutes);
app.use('/api/dialogue', dialogueLimiter, dialogueRoutes);
app.use('/api/teams', generalLimiter, teamRoutes);
app.use('/api/contacts', generalLimiter, contactRoutes);
app.use('/api/apikeys', generalLimiter, apikeyRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'ChronosAI API is running',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      meetings: '/api/meetings',
      dialogue: '/api/dialogue',
      teams: '/api/teams',
      contacts: '/api/contacts',
      apikeys: '/api/apikeys'
    }
  });
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Start meeting reminder cron job
    startReminderCron();
  });
}

export default app;
