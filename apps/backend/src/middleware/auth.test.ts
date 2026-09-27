import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../services/db');

// Imported after the mock so the middleware gets the mocked db module.
import * as db from '../services/db';
import { requireAuth, adminOnly } from './auth';
import { errorHandler } from './errorHandler';
import { config } from '../config';

const mockDb = db as jest.Mocked<typeof db>;

const app = express();
app.get('/protected', requireAuth, (req, res) => res.json({ user: req.user }));
app.get('/admin', adminOnly, (_req, res) => res.json({ ok: true }));
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

describe('activity for the business dashboard', () => {
  it('marks a user active once a day, not on every request', async () => {
    mockDb.isSessionActive.mockResolvedValue(true);
    const auth = `Bearer ${token({ sub: 'user-active', email: 'a@t.ng', sid: 'family-1' })}`;

    await request(app).get('/protected').set('Authorization', auth);
    await request(app).get('/protected').set('Authorization', auth);

    expect(mockDb.markActiveDay).toHaveBeenCalledTimes(1);
    expect(mockDb.markActiveDay).toHaveBeenCalledWith('user-active', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it('still lets the request through if recording activity fails, and tries again next time', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDb.isSessionActive.mockResolvedValue(true);
    mockDb.markActiveDay.mockRejectedValueOnce(new Error('db busy'));
    const auth = `Bearer ${token({ sub: 'user-flaky', email: 'a@t.ng', sid: 'family-1' })}`;

    expect((await request(app).get('/protected').set('Authorization', auth)).status).toBe(200);
    await request(app).get('/protected').set('Authorization', auth);

    expect(mockDb.markActiveDay).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});

describe('adminOnly', () => {
  const auth = (secret?: string) => `Bearer ${token({ sub: 'user-1', email: 'a@t.ng', sid: 'family-1' }, secret)}`;
  const looksMissing = (res: request.Response) => {
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND', message: 'Endpoint not found' });
  };

  it('answers an ordinary owner exactly as if the path did not exist', async () => {
    mockDb.isSessionActive.mockResolvedValue(true);
    mockDb.isAdmin.mockResolvedValue(false);
    looksMissing(await request(app).get('/admin').set('Authorization', auth()));
  });

  it('answers a request with no sign-in, a forged token, or a signed-out device the same way', async () => {
    looksMissing(await request(app).get('/admin'));
    looksMissing(await request(app).get('/admin').set('Authorization', auth('forged-secret')));
    mockDb.isSessionActive.mockResolvedValue(false);
    looksMissing(await request(app).get('/admin').set('Authorization', auth()));
    expect(mockDb.isAdmin).not.toHaveBeenCalled();
  });

  it('gives an expired sign-in the usual 401, so an admin\u2019s app can refresh it', async () => {
    const expired = jwt.sign({ sub: 'user-1', email: 'a@t.ng', sid: 'family-1', exp: Math.floor(Date.now() / 1000) - 60 }, config.jwt.accessSecret);
    const res = await request(app).get('/admin').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('lets an admin through', async () => {
    mockDb.isSessionActive.mockResolvedValue(true);
    mockDb.isAdmin.mockResolvedValue(true);
    const res = await request(app).get('/admin').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(mockDb.isAdmin).toHaveBeenCalledWith('user-1');
  });
});
