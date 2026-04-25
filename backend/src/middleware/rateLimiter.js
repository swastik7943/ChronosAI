import rateLimit from 'express-rate-limit';

// In test mode, skip all rate limiting to prevent tests from tripping limits
const isTest = () => process.env.NODE_ENV === 'test';

// General API rate limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 min
  skip: isTest,
  message: { message: 'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 attempts per 15 min
  skip: isTest,
  message: { message: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// AI/Dialogue limiter (more permissive for chat)
export const dialogueLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  skip: isTest,
  message: { message: 'Slow down! Too many messages. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false
});
