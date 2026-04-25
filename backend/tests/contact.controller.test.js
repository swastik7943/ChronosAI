/**
 * Integration Tests: Contact Controller
 * Route: /api/contacts
 *
 * The Contact model requires BOTH owner and contactUser to be registered users.
 * External emails are NOT supported — the controller returns 404 for missing users.
 *
 * Tests: add registered user as contact, duplicate prevention, list,
 *        search, user search, delete, auth guards
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/server.js';
import User from '../src/models/User.model.js';

jest.setTimeout(120000);

let mongoServer;
let ownerCookie;

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
  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  // Create owner and a contact candidate
  ownerCookie = await registerAndLogin('owner@test.com', 'Contact Owner');
  await registerAndLogin('alice@test.com', 'Alice Smith');
});

// ── POST /api/contacts ─────────────────────────────────────────────
describe('POST /api/contacts', () => {
  it('adds a registered user as a contact — returns populated contactUser', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .set('Cookie', ownerCookie)
      .send({ email: 'alice@test.com' });

    expect(res.statusCode).toBe(201);
    expect(res.body.contactUser.email).toBe('alice@test.com');
  });

  it('returns 404 when adding a non-registered email', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .set('Cookie', ownerCookie)
      .send({ email: 'unknown@external.com' });

    expect(res.statusCode).toBe(404);
  });

  it('prevents adding the same contact twice', async () => {
    await request(app)
      .post('/api/contacts')
      .set('Cookie', ownerCookie)
      .send({ email: 'alice@test.com' });

    const res = await request(app)
      .post('/api/contacts')
      .set('Cookie', ownerCookie)
      .send({ email: 'alice@test.com' });

    expect(res.statusCode).toBe(400);
  });

  it('prevents adding yourself as a contact', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .set('Cookie', ownerCookie)
      .send({ email: 'owner@test.com' });

    expect(res.statusCode).toBe(400);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .send({ email: 'alice@test.com' });
    expect(res.statusCode).toBe(401);
  });
});

// ── GET /api/contacts ──────────────────────────────────────────────
describe('GET /api/contacts', () => {
  it('returns an empty list when user has no contacts', async () => {
    const res = await request(app)
      .get('/api/contacts')
      .set('Cookie', ownerCookie);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('returns contacts with populated email after adding', async () => {
    await request(app)
      .post('/api/contacts')
      .set('Cookie', ownerCookie)
      .send({ email: 'alice@test.com' });

    const res = await request(app)
      .get('/api/contacts')
      .set('Cookie', ownerCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].contactUser.email).toBe('alice@test.com');
  });
});

// ── GET /api/contacts/search?q= ────────────────────────────────────
describe('GET /api/contacts/search', () => {
  beforeEach(async () => {
    await request(app).post('/api/contacts').set('Cookie', ownerCookie).send({ email: 'alice@test.com' });
  });

  it('returns matching contacts by name fragment', async () => {
    const res = await request(app)
      .get('/api/contacts/search?q=Alice')
      .set('Cookie', ownerCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.some(c => c.contactUser.email === 'alice@test.com')).toBe(true);
  });

  it('returns empty for non-matching query', async () => {
    const res = await request(app)
      .get('/api/contacts/search?q=zzznomatch')
      .set('Cookie', ownerCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(0);
  });
});

// ── GET /api/contacts/users?q= ─────────────────────────────────────
describe('GET /api/contacts/users (user search)', () => {
  it('finds registered users by name fragment', async () => {
    const res = await request(app)
      .get('/api/contacts/users?q=Alice')
      .set('Cookie', ownerCookie);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(u => u.email === 'alice@test.com')).toBe(true);
  });

  it('does not return password or sensitive fields in user search', async () => {
    const res = await request(app)
      .get('/api/contacts/users?q=Alice')
      .set('Cookie', ownerCookie);

    expect(res.body.every(u => !u.password)).toBe(true);
    expect(res.body.every(u => !u.googleAccessToken)).toBe(true);
  });

  it('returns empty for queries shorter than 2 characters', async () => {
    const res = await request(app)
      .get('/api/contacts/users?q=A')
      .set('Cookie', ownerCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(0);
  });
});

// ── DELETE /api/contacts/:id ───────────────────────────────────────
describe('DELETE /api/contacts/:id', () => {
  it('removes a contact from the user\'s list', async () => {
    const addRes = await request(app)
      .post('/api/contacts')
      .set('Cookie', ownerCookie)
      .send({ email: 'alice@test.com' });
    const contactId = addRes.body._id;

    const deleteRes = await request(app)
      .delete(`/api/contacts/${contactId}`)
      .set('Cookie', ownerCookie);

    expect(deleteRes.statusCode).toBe(200);

    const listRes = await request(app)
      .get('/api/contacts')
      .set('Cookie', ownerCookie);
    expect(listRes.body.length).toBe(0);
  });
});
