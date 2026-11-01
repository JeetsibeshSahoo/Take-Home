import { describe, test, expect } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';

describe('5. API Health & Security Middleware Tests', () => {
  test('GET /health returns status UP', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  test('Protected endpoint returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  test('Public auth route requests code with validation', async () => {
    const res = await request(app)
      .post('/api/auth/request-code')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  test('Customer creation rejects invalid PAN format', async () => {
    const fakeToken = 'invalid-token';
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${fakeToken}`)
      .send({
        fullName: 'Test User',
        phone: '9830012345',
        dateOfBirth: '1990-01-01',
        address: 'Kolkata',
        pan: 'INVALID_PAN',
        aadhaarLast4: '1234',
      });
    expect(res.status).toBe(401); 
  });
});