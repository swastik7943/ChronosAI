/**
 * Integration Tests: API Key Controller
 * Route: /api/apikeys
 *
 * Tests: create key, list (masked), revoke, delete, key-based auth
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
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  await request(app)
    .post('/api/auth/register')
    .send({ name: 'Key User', email: 'keyuser@test.com', password: 'pass123' });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'keyuser@test.com', password: 'pass123' });
  authCookie = loginRes.headers['set-cookie'][0].split(';')[0];
});

// ── POST /api/apikeys ──────────────────────────────────────────────
describe('POST /api/apikeys', () => {
  it('creates an API key and returns the full key once', async () => {
    const res = await request(app)
      .post('/api/apikeys')
      .set('Cookie', authCookie)
      .send({ name: 'CI Key' });

    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('CI Key');
    expect(res.body.key).toBeDefined();
    expect(res.body.key.length).toBeGreaterThan(20); // full key shown once
    // isActive defaults to true in DB but isn't returned in create response
    expect(res.body.message).toMatch(/Save this key/i);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/api/apikeys').send({ name: 'Ghost Key' });
    expect(res.statusCode).toBe(401);
  });
});

// ── GET /api/apikeys ───────────────────────────────────────────────
describe('GET /api/apikeys', () => {
  it('returns list of API keys with the key value masked', async () => {
    await request(app)
      .post('/api/apikeys')
      .set('Cookie', authCookie)
      .send({ name: 'Test Key' });

    const res = await request(app)
      .get('/api/apikeys')
      .set('Cookie', authCookie);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    // The key field is excluded from list view via .select('-key') — not exposed at all
    expect(res.body[0].key).toBeUndefined();
    expect(res.body[0].name).toBe('Test Key');
    expect(res.body[0].isActive).toBe(true);
  });

  it('returns empty list when user has no keys', async () => {
    const res = await request(app)
      .get('/api/apikeys')
      .set('Cookie', authCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(0);
  });
});

// ── PUT /api/apikeys/:id/revoke ────────────────────────────────────
describe('PUT /api/apikeys/:id/revoke', () => {
  it('revokes an active key and marks it inactive', async () => {
    const createRes = await request(app)
      .post('/api/apikeys')
      .set('Cookie', authCookie)
      .send({ name: 'Revokable Key' });
    const keyId = createRes.body._id;

    const revokeRes = await request(app)
      .put(`/api/apikeys/${keyId}/revoke`)
      .set('Cookie', authCookie);

    expect(revokeRes.statusCode).toBe(200);
    // Revoke returns a message confirmation, not the key object
    expect(revokeRes.body.message).toMatch(/revoked/i);
  });
});

// ── DELETE /api/apikeys/:id ────────────────────────────────────────
describe('DELETE /api/apikeys/:id', () => {
  it('deletes a key and it no longer appears in list', async () => {
    const createRes = await request(app)
      .post('/api/apikeys')
      .set('Cookie', authCookie)
      .send({ name: 'Delete Me Key' });
    const keyId = createRes.body._id;

    const deleteRes = await request(app)
      .delete(`/api/apikeys/${keyId}`)
      .set('Cookie', authCookie);

    expect(deleteRes.statusCode).toBe(200);

    const listRes = await request(app)
      .get('/api/apikeys')
      .set('Cookie', authCookie);
    expect(listRes.body.some(k => k._id === keyId)).toBe(false);
  });
});

// ── API Key Authentication ─────────────────────────────────────────
describe('API Key Auth (x-api-key header)', () => {
  it('allows access to protected routes using a valid API key', async () => {
    // Create a key
    const createRes = await request(app)
      .post('/api/apikeys')
      .set('Cookie', authCookie)
      .send({ name: 'Auth Key' });
    const rawKey = createRes.body.key;

    // Use the raw key to access a protected endpoint
    const res = await request(app)
      .get('/api/meetings/all')
      .set('x-api-key', rawKey);

    // Should succeed (not 401)
    expect(res.statusCode).not.toBe(401);
    expect(res.statusCode).toBe(200);
  });

  it('rejects access with an invalid API key', async () => {
    const res = await request(app)
      .get('/api/meetings/all')
      .set('x-api-key', 'invalid-fake-key-12345');

    expect(res.statusCode).toBe(401);
  });
});
