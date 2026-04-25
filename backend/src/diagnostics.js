import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Current __dirname:', __dirname);
const envPath = path.resolve(__dirname, '../../.env');
console.log('Target .env path:', envPath);
console.log('.env file exists:', fs.existsSync(envPath));

const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('dotenv error:', result.error);
} else {
  console.log('dotenv loaded successfully');
  console.log('MONGODB_URI present:', !!process.env.MONGODB_URI);
  console.log('JWT_SECRET present:', !!process.env.JWT_SECRET);
  console.log('ENCRYPTION_KEY present:', !!process.env.ENCRYPTION_KEY);
  console.log('ENCRYPTION_KEY length:', process.env.ENCRYPTION_KEY ? process.env.ENCRYPTION_KEY.length : 0);
  if (process.env.MONGODB_URI) {
     console.log('MONGODB_URI starts with:', process.env.MONGODB_URI.substring(0, 20));
  }
}
