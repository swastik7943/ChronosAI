/**
 * Jest Global Setup — runs ONCE before all test suites
 * Sets MONGODB_URI env var to prevent server.js from connecting
 * before the test's own MongoMemoryServer is started.
 */
export default async function globalSetup() {
  // Signal to server.js that we're in test mode (it already checks NODE_ENV=test)
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/chronosai-test-placeholder';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!';
}
