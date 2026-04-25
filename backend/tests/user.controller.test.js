/**
 * Integration Tests: User Controller
 * Route: /api/users
 *
 * Tests: GET /settings, PUT /settings field updates, POST /google-disconnect
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/server.js';
import User from '../src/models/User.model.js';

jest.setTimeout(120000);

let mongoServer;
let authCookie;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await request(app)
    .post('/api/auth/register')
    .send({ name: 'Settings User', email: 'settings@test.com', password: 'pass123' });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'settings@test.com', password: 'pass123' });
  authCookie = loginRes.headers['set-cookie'][0].split(';')[0];
});

// ── GET /api/users/settings ────────────────────────────────────────
describe('GET /api/users/settings', () => {
  it('returns the user profile without password field', async () => {
    const res = await request(app)
      .get('/api/users/settings')
      .set('Cookie', authCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('settings@test.com');
    expect(res.body.name).toBe('Settings User');
    expect(res.body.password).toBeUndefined(); // must not expose password
  });

  it('includes scheduling fields with defaults', async () => {
    const res = await request(app)
      .get('/api/users/settings')
      .set('Cookie', authCookie);

    expect(res.body.timezone).toBe('UTC');
    expect(res.body.bufferTime).toBe(0);
    expect(res.body.workingHoursStart).toBe('09:00');
    expect(res.body.workingHoursEnd).toBe('18:00');
    expect(res.body.breakStart).toBe('13:00');
    expect(res.body.breakEnd).toBe('14:00');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/users/settings');
    expect(res.statusCode).toBe(401);
  });
});

// ── PUT /api/users/settings ────────────────────────────────────────
describe('PUT /api/users/settings', () => {
  it('updates timezone successfully', async () => {
    const res = await request(app)
      .put('/api/users/settings')
      .set('Cookie', authCookie)
      .send({ timezone: 'IST' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.timezone).toBe('IST');
  });

  it('updates working hours successfully', async () => {
    const res = await request(app)
      .put('/api/users/settings')
      .set('Cookie', authCookie)
      .send({ workingHoursStart: '08:00', workingHoursEnd: '17:00' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.workingHoursStart).toBe('08:00');
    expect(res.body.user.workingHoursEnd).toBe('17:00');
  });

  it('updates buffer time to a positive value', async () => {
    const res = await request(app)
      .put('/api/users/settings')
      .set('Cookie', authCookie)
      .send({ bufferTime: 15 });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.bufferTime).toBe(15);
  });

  it('updates break times', async () => {
    const res = await request(app)
      .put('/api/users/settings')
      .set('Cookie', authCookie)
      .send({ breakStart: '12:30', breakEnd: '13:30' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.breakStart).toBe('12:30');
    expect(res.body.user.breakEnd).toBe('13:30');
  });

  it('persists updates across subsequent GET requests', async () => {
    await request(app)
      .put('/api/users/settings')
      .set('Cookie', authCookie)
      .send({ timezone: 'PST', bufferTime: 10 });

    const getRes = await request(app)
      .get('/api/users/settings')
      .set('Cookie', authCookie);

    expect(getRes.body.timezone).toBe('PST');
    expect(getRes.body.bufferTime).toBe(10);
  });

  it('returns 401 for unauthenticated update', async () => {
    const res = await request(app)
      .put('/api/users/settings')
      .send({ timezone: 'JST' });
    expect(res.statusCode).toBe(401);
  });
});

// ── POST /api/users/google-disconnect ─────────────────────────────
describe('POST /api/users/google-disconnect', () => {
  it('clears Google tokens and returns success message', async () => {
    // Manually set Google tokens on the user
    await User.findOneAndUpdate(
      { email: 'settings@test.com' },
      { googleId: 'gid-123', googleAccessToken: 'enc-token', googleRefreshToken: 'enc-refresh' }
    );

    const res = await request(app)
      .post('/api/users/google-disconnect')
      .set('Cookie', authCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/disconnected/i);

    // Verify tokens are cleared in DB
    const user = await User.findOne({ email: 'settings@test.com' });
    expect(user.googleId).toBeUndefined();
    expect(user.googleAccessToken).toBeUndefined();
    expect(user.googleRefreshToken).toBeUndefined();
  });

  it('is idempotent — works even when not connected', async () => {
    const res = await request(app)
      .post('/api/users/google-disconnect')
      .set('Cookie', authCookie);
    expect(res.statusCode).toBe(200);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/users/google-disconnect');
    expect(res.statusCode).toBe(401);
  });
});
