import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

jest.mock('../services/db');

// Imported after the mock so the routes get the mocked db module.
import * as db from '../services/db';
import authRoutes from './auth';
import { errorHandler } from '../middleware/errorHandler';

const mockDb = db as jest.Mocked<typeof db>;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/v1/auth', authRoutes);
app.use(errorHandler);

const user = {
  id: 'user-1', name: 'Amara Okafor', email: 'amara@test.ng', phone: undefined,
} as unknown as NonNullable<Awaited<ReturnType<typeof db.findUserById>>>;

function refreshCookie(res: request.Response): string | undefined {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  return cookies?.find((c) => c.startsWith('refresh_token='));
}

beforeEach(() => jest.clearAllMocks());

describe('POST /auth/refresh', () => {
  it('rejects a request with no refresh cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(mockDb.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('rotates the token and returns a new access token plus the user', async () => {
    mockDb.rotateRefreshToken.mockResolvedValue({ status: 'rotated', userId: 'user-1', familyId: 'family-1' });
    mockDb.findUserById.mockResolvedValue(user);

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', 'refresh_token=old-token');

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: 'user-1', name: 'Amara Okafor', email: 'amara@test.ng' });
    // The access token names the device session, so signing that device out cuts it off.
    expect(jwt.decode(res.body.accessToken)).toMatchObject({ sub: 'user-1', sid: 'family-1' });
    const [oldHash, newHash] = mockDb.rotateRefreshToken.mock.calls[0]!;
    expect(oldHash).toMatch(/^[0-9a-f]{64}$/); // only the hash ever reaches the database
    expect(newHash).not.toBe(oldHash);
    const cookie = refreshCookie(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookie).not.toContain('refresh_token=old-token');
  });

  it.each(['invalid', 'reused'] as const)('rejects a %s token and clears the cookie', async (status) => {
    mockDb.rotateRefreshToken.mockResolvedValue({ status });

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', 'refresh_token=bad');

    expect(res.status).toBe(401);
    expect(refreshCookie(res)).toMatch(/^refresh_token=;/);
    expect(mockDb.findUserById).not.toHaveBeenCalled();
  });
});

describe('POST /auth/logout', () => {
  it('revokes this device\'s session from the cookie alone, with no access token', async () => {
    const res = await request(app).post('/api/v1/auth/logout').set('Cookie', 'refresh_token=tok');

    expect(res.status).toBe(204);
    expect(mockDb.revokeRefreshTokenFamily).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(refreshCookie(res)).toMatch(/^refresh_token=;/);
  });

  it('succeeds even when there is no cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(204);
    expect(mockDb.revokeRefreshTokenFamily).not.toHaveBeenCalled();
  });
});

describe('POST /auth/login', () => {
  it('looks the email up lowercased and starts a new session', async () => {
    const passwordHash = await bcrypt.hash('StrongPass1!', 4);
    mockDb.findUserByEmail.mockResolvedValue({ ...user, passwordHash, loginAttempts: 0, lockoutUntil: null });

    const res = await request(app).post('/api/v1/auth/login').send({ email: '  Amara@Test.NG ', password: 'StrongPass1!' });

    expect(res.status).toBe(200);
    expect(mockDb.findUserByEmail).toHaveBeenCalledWith('amara@test.ng');
    expect(mockDb.createRefreshToken).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', familyId: expect.any(String), tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(refreshCookie(res)).toMatch(/HttpOnly/);
    const familyId = mockDb.createRefreshToken.mock.calls[0]![0].familyId;
    expect(jwt.decode(res.body.accessToken)).toMatchObject({ sub: 'user-1', sid: familyId });
  });

  it('gives the same answer for an unknown email as for a wrong password', async () => {
    mockDb.findUserByEmail.mockResolvedValue(null);
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@test.ng', password: 'x' });

    const passwordHash = await bcrypt.hash('StrongPass1!', 4);
    mockDb.findUserByEmail.mockResolvedValue({ ...user, passwordHash, loginAttempts: 0, lockoutUntil: null });
    const wrong = await request(app).post('/api/v1/auth/login').send({ email: 'amara@test.ng', password: 'wrong' });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    expect(mockDb.createRefreshToken).not.toHaveBeenCalled();
  });
});
