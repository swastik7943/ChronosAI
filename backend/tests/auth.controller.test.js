/**
 * Integration Tests: Auth Controller
 * Route: /api/auth
 *
 * Tests: register, login, logout, /me, duplicate email, wrong password
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/server.js';
import User from '../src/models/User.model.js';

jest.setTimeout(120000);

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('POST /api/auth/register', () => {
  it('registers a new user and sets an HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@test.com', password: 'secure123' });

    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('Alice');
    expect(res.body.token).toBeUndefined(); // never expose token in body
    const cookie = res.headers['set-cookie']?.[0];
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/token=/);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('rejects registration when email is already taken', async () => {
    await User.create({ name: 'Alice', email: 'alice@test.com', password: 'secure123' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice2', email: 'alice@test.com', password: 'other123' });

    expect(res.statusCode).toBe(400);
  });

  it('rejects registration with missing required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'noname@test.com' }); // missing name & password

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'bob@test.com', password: 'mypassword' });
  });

  it('logs in with valid credentials and sets cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@test.com', password: 'mypassword' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@test.com', password: 'wrongpass' });

    expect(res.statusCode).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects login with non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'anything' });

    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the auth cookie on logout', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.statusCode).toBe(200);
    // Cookie should be cleared (max-age=0 or expires in past)
    const cookie = res.headers['set-cookie']?.[0] || '';
    expect(cookie.toLowerCase()).toMatch(/token=;|expires=thu, 01 jan 1970|max-age=0/i);
  });
});

describe('GET /api/auth/me', () => {
  let authCookie;

  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Charlie', email: 'charlie@test.com', password: 'pass123' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'charlie@test.com', password: 'pass123' });
    authCookie = loginRes.headers['set-cookie'][0].split(';')[0];
  });

  it('returns user profile for authenticated request', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', authCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('charlie@test.com');
    expect(res.body.password).toBeUndefined();
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });
});
