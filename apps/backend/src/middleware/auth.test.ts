import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../services/db');

// Imported after the mock so the middleware gets the mocked db module.
import * as db from '../services/db';
import { requireAuth } from './auth';
import { errorHandler } from './errorHandler';
import { config } from '../config';

const mockDb = db as jest.Mocked<typeof db>;

const app = express();
app.get('/protected', requireAuth, (req, res) => res.json({ user: req.user }));
app.use(errorHandler);

function token(payload: object, secret = config.jwt.accessSecret) {
  return jwt.sign(payload, secret, { expiresIn: '15m' });
}

beforeEach(() => jest.clearAllMocks());

describe('requireAuth', () => {
  it('lets a request through while its device session is signed in', async () => {
    mockDb.isSessionActive.mockResolvedValue(true);

    const res = await request(app).get('/protected')
      .set('Authorization', `Bearer ${token({ sub: 'user-1', email: 'a@t.ng', sid: 'family-1' })}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 'user-1', email: 'a@t.ng' });
    expect(mockDb.isSessionActive).toHaveBeenCalledWith('family-1', 'user-1');
  });

  it('rejects a still-unexpired token once its device has signed out', async () => {
    mockDb.isSessionActive.mockResolvedValue(false);

    const res = await request(app).get('/protected')
      .set('Authorization', `Bearer ${token({ sub: 'user-1', email: 'a@t.ng', sid: 'family-1' })}`);

    expect(res.status).toBe(401);
  });

  it('rejects a token with no session id (issued before sessions were tracked)', async () => {
    const res = await request(app).get('/protected')
      .set('Authorization', `Bearer ${token({ sub: 'user-1', email: 'a@t.ng' })}`);

    expect(res.status).toBe(401);
    expect(mockDb.isSessionActive).not.toHaveBeenCalled();
  });

  it('rejects a token signed with a different secret without touching the database', async () => {
    const res = await request(app).get('/protected')
      .set('Authorization', `Bearer ${token({ sub: 'user-1', email: 'a@t.ng', sid: 'f' }, 'forged-secret')}`);

    expect(res.status).toBe(401);
    expect(mockDb.isSessionActive).not.toHaveBeenCalled();
  });
});
