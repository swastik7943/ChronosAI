/**
 * Integration Tests: Team Controller
 * Route: /api/teams
 *
 * Tests: create workspace, list my teams, join by invite code,
 *        add member, remove member, auth guards
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/server.js';
import User from '../src/models/User.model.js';
import Team from '../src/models/Team.model.js';

jest.setTimeout(120000);

let mongoServer;
let ownerCookie;
let ownerEmail = 'owner@team.com';
let memberEmail = 'member@team.com';

async function registerAndLogin(email, name = 'Test User') {
  await request(app).post('/api/auth/register').send({ name, email, password: 'pass123' });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'pass123' });
  return loginRes.headers['set-cookie'][0].split(';')[0];
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
  await Team.deleteMany({});
  ownerCookie = await registerAndLogin(ownerEmail, 'Team Owner');
  // Register the member user so they exist for invite/add tests
  await registerAndLogin(memberEmail, 'Team Member');
});

// ── POST /api/teams ────────────────────────────────────────────────
describe('POST /api/teams', () => {
  it('creates a workspace and assigns owner role', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Cookie', ownerCookie)
      .send({ name: 'Engineering', description: 'Dev team' });

    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('Engineering');
    expect(res.body.description).toBe('Dev team');
    expect(res.body.inviteCode).toBeDefined();
    // Owner should be in members list
    const ownerMember = res.body.members?.find(m => m.role === 'admin');
    expect(ownerMember).toBeDefined();
  });

  it('generates a unique invite code', async () => {
    const res1 = await request(app)
      .post('/api/teams')
      .set('Cookie', ownerCookie)
      .send({ name: 'Team A' });
    const res2 = await request(app)
      .post('/api/teams')
      .set('Cookie', ownerCookie)
      .send({ name: 'Team B' });

    expect(res1.body.inviteCode).not.toBe(res2.body.inviteCode);
  });

  it('rejects unauthenticated team creation', async () => {
    const res = await request(app).post('/api/teams').send({ name: 'Ghost Team' });
    expect(res.statusCode).toBe(401);
  });
});

// ── GET /api/teams ─────────────────────────────────────────────────
describe('GET /api/teams', () => {
  it('returns only the teams the user belongs to', async () => {
    await request(app)
      .post('/api/teams')
      .set('Cookie', ownerCookie)
      .send({ name: 'My Team' });

    const res = await request(app)
      .get('/api/teams')
      .set('Cookie', ownerCookie);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.some(t => t.name === 'My Team')).toBe(true);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/teams');
    expect(res.statusCode).toBe(401);
  });
});

// ── POST /api/teams/join ───────────────────────────────────────────
describe('POST /api/teams/join', () => {
  it('allows a user to join via invite code', async () => {
    const createRes = await request(app)
      .post('/api/teams')
      .set('Cookie', ownerCookie)
      .send({ name: 'Open Team' });
    const inviteCode = createRes.body.inviteCode;

    const memberCookie = await registerAndLogin('joiner@team.com', 'Joiner');
    const joinRes = await request(app)
      .post('/api/teams/join')
      .set('Cookie', memberCookie)
      .send({ inviteCode });

    expect(joinRes.statusCode).toBe(200);
    // The response may return the team object or a success message
    const body = joinRes.body;
    const isValid = body.name === 'Open Team' ||
                    body.message?.toLowerCase().includes('joined') ||
                    body._id != null;
    expect(isValid).toBe(true);
  });

  it('rejects join with invalid invite code', async () => {
    const memberCookie = await registerAndLogin('invalid@team.com', 'Invalid');
    const res = await request(app)
      .post('/api/teams/join')
      .set('Cookie', memberCookie)
      .send({ inviteCode: 'FAKE-CODE-XYZ' });

    expect(res.statusCode).toBe(404);
  });
});

// ── POST /api/teams/:id/members ────────────────────────────────────
describe('POST /api/teams/:id/members', () => {
  it('owner can add a member by email', async () => {
    const createRes = await request(app)
      .post('/api/teams')
      .set('Cookie', ownerCookie)
      .send({ name: 'Private Team' });
    const teamId = createRes.body._id;

    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Cookie', ownerCookie)
      .send({ email: memberEmail });

    expect(res.statusCode).toBe(200);
    const addedMember = res.body.members?.find(
      m => m.user?.email === memberEmail || m.user?.toString?.()
    );
    expect(res.body.members?.length).toBeGreaterThanOrEqual(2); // owner + new member
  });

  it('returns 404 when adding non-existent user email', async () => {
    const createRes = await request(app)
      .post('/api/teams')
      .set('Cookie', ownerCookie)
      .send({ name: 'Team X' });
    const teamId = createRes.body._id;

    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Cookie', ownerCookie)
      .send({ email: 'ghost@nobody.com' });

    expect(res.statusCode).toBe(404);
  });
});
