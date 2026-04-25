import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import { spawn } from 'child_process';
import cors from 'cors';

(async () => {
  // 1. Start InMemory DB
  const mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.JWT_SECRET = 'secret123';
  process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
  process.env.NODE_ENV = 'development';
  process.env.AI_SERVICE_URL = 'http://localhost:8000';

  console.log('MongoDB started at:', process.env.MONGO_URI);

  // 2. Start mock AI Service
  const aiApp = express();
  aiApp.use(cors());
  aiApp.use(express.json());
  
  aiApp.post('/parse', (req, res) => {
    const text = req.body.message.toLowerCase();
    
    let intent = 'unknown';
    let date = null;
    let time = null;
    const participants = [];
    
    if (text.includes('schedule')) {
      intent = 'schedule';
      if (text.includes('marketing')) participants.push('marketing@example.com');
      if (text.includes('tomorrow')) date = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      if (text.includes('2')) time = '14:00';
    } else if (text.includes('cancel')) {
      intent = 'cancel';
    }
    
    res.json({ intent, date, time, duration: 30, participants });
  });

  aiApp.listen(8000, () => {
    console.log('Mock AI Service running on 8000');
    
    // 3. Start Backend
    spawn('node', ['src/server.js'], { stdio: 'inherit', cwd: '.', env: process.env });
    
    // 4. Start Frontend
    spawn('npm.cmd', ['run', 'dev'], { stdio: 'inherit', cwd: '../frontend', env: process.env, shell: true });
  });
})();
