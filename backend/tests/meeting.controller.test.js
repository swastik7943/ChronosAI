/**
 * Integration Tests: Meeting Controller
 * Route: /api/meetings
 *
 * Tests: schedule, list all, list by date, reschedule, cancel, auth guards
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/server.js';
import User from '../src/models/User.model.js';
import Meeting from '../src/models/Meeting.model.js';

jest.setTimeout(120000);

let mongoServer;
let authCookie;
let userId;

// ── Shared test helpers ────────────────────────────────────────────
async function createUserAndLogin(email = 'mtg@test.com') {
  await request(app)
    .post('/api/auth/register')
    .send({ name: 'Meeting User', email, password: 'pass123' });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'pass123' });
  const user = await User.findOne({ email });
  return {
    cookie: loginRes.headers['set-cookie'][0].split(';')[0],
    userId: user._id.toString()
  };
}

async function scheduleMeeting(cookie, overrides = {}) {
  return request(app)
    .post('/api/meetings/schedule')
    .set('Cookie', cookie)
    .send({
      title: 'Team Sync',
      date: '2027-08-16', // Monday
      startTime: '10:00',
      duration: 30,
      participants: ['partner@external.com'],
      ...overrides
    });
}

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
  await Meeting.deleteMany({});
  const result = await createUserAndLogin();
  authCookie = result.cookie;
  userId = result.userId;
});

// ── POST /api/meetings/schedule ────────────────────────────────────
describe('POST /api/meetings/schedule', () => {
  it('creates a meeting and returns it with a jitsiRoom', async () => {
    const res = await scheduleMeeting(authCookie);

    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe('Team Sync');
    expect(res.body.date).toBe('2027-08-16');
    expect(res.body.startTime).toBe('10:00');
    expect(res.body.duration).toBe(30);
    expect(res.body.jitsiRoom).toMatch(/^chronosai-/);
    expect(res.body.status).toBe('scheduled');
  });

  it('uses default title "New Meeting" when title is omitted', async () => {
    const res = await scheduleMeeting(authCookie, { title: undefined });
    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe('New Meeting');
  });

  it('uses default duration of 30 when omitted', async () => {
    const res = await scheduleMeeting(authCookie, { duration: undefined });
    expect(res.statusCode).toBe(201);
    expect(res.body.duration).toBe(30);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/meetings/schedule')
      .send({ title: 'Spy Meeting', date: '2027-08-16', startTime: '10:00', duration: 30 });
    expect(res.statusCode).toBe(401);
  });

  it('stores participants correctly', async () => {
    const res = await scheduleMeeting(authCookie, {
      participants: ['alice@test.com', 'bob@test.com']
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.participants).toContain('alice@test.com');
    expect(res.body.participants).toContain('bob@test.com');
  });
});

// ── GET /api/meetings/all ──────────────────────────────────────────
describe('GET /api/meetings/all', () => {
  it('returns only the authenticated user\'s scheduled meetings', async () => {
    await scheduleMeeting(authCookie);
    await scheduleMeeting(authCookie, { title: 'Second Meeting', startTime: '14:00' });

    const res = await request(app)
      .get('/api/meetings/all')
      .set('Cookie', authCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body.every(m => m.status === 'scheduled')).toBe(true);
  });

  it('does not return another user\'s meetings', async () => {
    // Create a second user and their meeting
    const other = await createUserAndLogin('other@test.com');
    await scheduleMeeting(other.cookie, { title: 'Other Meeting' });

    const res = await request(app)
      .get('/api/meetings/all')
      .set('Cookie', authCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.every(m => m.title !== 'Other Meeting')).toBe(true);
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/meetings/all');
    expect(res.statusCode).toBe(401);
  });
});

// ── GET /api/meetings/date/:date ───────────────────────────────────
describe('GET /api/meetings/date/:date', () => {
  it('returns meetings for a specific date', async () => {
    await scheduleMeeting(authCookie, { date: '2027-08-16' });
    await scheduleMeeting(authCookie, { date: '2027-08-17', startTime: '11:00' });

    const res = await request(app)
      .get('/api/meetings/date/2027-08-16')
      .set('Cookie', authCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].date).toBe('2027-08-16');
  });

  it('returns empty array for a date with no meetings', async () => {
    const res = await request(app)
      .get('/api/meetings/date/2090-01-01')
      .set('Cookie', authCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── PUT /api/meetings/reschedule/:id ──────────────────────────────
describe('PUT /api/meetings/reschedule/:id', () => {
  it('reschedules a meeting with new date and time', async () => {
    const createRes = await scheduleMeeting(authCookie);
    const meetingId = createRes.body._id;

    const res = await request(app)
      .put(`/api/meetings/reschedule/${meetingId}`)
      .set('Cookie', authCookie)
      .send({ date: '2027-09-01', startTime: '15:00', duration: 60 });

    expect(res.statusCode).toBe(200);
    expect(res.body.date).toBe('2027-09-01');
    expect(res.body.startTime).toBe('15:00');
    expect(res.body.duration).toBe(60);
  });

  it('returns 401 when another user tries to reschedule', async () => {
    const createRes = await scheduleMeeting(authCookie);
    const meetingId = createRes.body._id;

    const other = await createUserAndLogin('rogue@test.com');
    const res = await request(app)
      .put(`/api/meetings/reschedule/${meetingId}`)
      .set('Cookie', other.cookie)
      .send({ date: '2027-09-01' });

    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for non-existent meeting', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .put(`/api/meetings/reschedule/${fakeId}`)
      .set('Cookie', authCookie)
      .send({ date: '2027-09-01' });

    expect(res.statusCode).toBe(404);
  });
});

// ── DELETE /api/meetings/cancel/:id ───────────────────────────────
describe('DELETE /api/meetings/cancel/:id', () => {
  it('cancels a meeting and sets status to canceled', async () => {
    const createRes = await scheduleMeeting(authCookie);
    const meetingId = createRes.body._id;

    const res = await request(app)
      .delete(`/api/meetings/cancel/${meetingId}`)
      .set('Cookie', authCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/canceled/i);

    // Verify the DB record
    const inDb = await Meeting.findById(meetingId);
    expect(inDb.status).toBe('canceled');
  });

  it('prevents another user from canceling the meeting', async () => {
    const createRes = await scheduleMeeting(authCookie);
    const meetingId = createRes.body._id;

    const other = await createUserAndLogin('attacker@test.com');
    const res = await request(app)
      .delete(`/api/meetings/cancel/${meetingId}`)
      .set('Cookie', other.cookie);

    expect(res.statusCode).toBe(401);
  });

  it('includes a canceled meeting in /api/meetings/all', async () => {
    const createRes = await scheduleMeeting(authCookie);
    const meetingId = createRes.body._id;

    await request(app)
      .delete(`/api/meetings/cancel/${meetingId}`)
      .set('Cookie', authCookie);

    const allRes = await request(app)
      .get('/api/meetings/all')
      .set('Cookie', authCookie);

    expect(allRes.body.some(m => m._id === meetingId && m.status === 'canceled')).toBe(true);
  });
});
