import { Router, Request, Response, NextFunction, CookieOptions } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import * as db from '../services/db';

const router = Router();

const REFRESH_COOKIE = 'refresh_token';
// Only the auth endpoints ever read the refresh token, so the browser sends it nowhere else.
const REFRESH_COOKIE_PATH = '/api/v1/auth';
// A token revoked this recently is a parallel refresh racing the rotation (two tabs
// reloading together), not a replay — reject it without signing the device out.
const REUSE_GRACE_MS = 30_000;

// Compared against when the email is unknown, so a missing account takes as long to
// reject as a wrong password and response time doesn't reveal which emails exist.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-password', 12);

const email = z.string().trim().toLowerCase().email();

const signupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  phone: z.string().optional(),
  password: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d])/,
    'Password must contain uppercase, lowercase, digit, and special character',
  ),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1),
});

// Limits from docs/api/openapi.yaml. Login counts failed attempts only, so owners
// sharing a carrier IP aren't blocked by each other's successful logins.
const signupLimiter = rateLimit({
  windowMs: 60 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many sign-ups from this network. Try again later.' },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 5, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many failed logins. Try again in 15 minutes.' },
});

router.post('/signup', signupLimiter, validate(signupSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, phone, password } = req.body;
    const existing = await db.findUserByEmail(email);
    if (existing) throw new AppError(409, 'CONFLICT', 'Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.createUser({ name, email, phone, passwordHash });

    await startSession(res, user.id);
    res.status(201).json({ accessToken: signAccessToken(user.id, user.email), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const user = await db.findUserByEmail(email);

    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
    }
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      throw new AppError(429, 'TOO_MANY_REQUESTS', 'Account locked. Try again in 15 minutes.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await db.incrementLoginAttempts(user.email);
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
    }

    await db.resetLoginAttempts(user.email);
    await startSession(res, user.id);
    res.json({ accessToken: signAccessToken(user.id, user.email), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// Called on every app load to restore the session, and whenever the access token
// expires. Returns the user too, so the app can restore who is signed in.
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new AppError(401, 'UNAUTHORIZED', 'Refresh token missing');

    const replacement = newRefreshToken();
    const rotation = await db.rotateRefreshToken(hashToken(token), replacement.hash, replacement.expiresAt, REUSE_GRACE_MS);
    if (rotation.status !== 'rotated') {
      if (rotation.status === 'reused') console.warn('Refresh token reuse detected; session revoked');
      res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
      throw new AppError(401, 'UNAUTHORIZED', 'Session expired. Please log in again.');
    }

    const user = await db.findUserById(rotation.userId);
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'User not found');

    setRefreshCookie(res, replacement.token);
    res.json({ accessToken: signAccessToken(user.id, user.email), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// Works from the refresh cookie alone: an owner whose access token has already
// expired must still be able to sign this device out.
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
    if (token) await db.revokeRefreshTokenFamily(hashToken(token));
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── Helpers ──────────────────────────────────────────────────
function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/** Refresh tokens are opaque random strings; only their SHA-256 hash is stored. */
function newRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + config.jwt.refreshTtlMs) };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Starts a new token family — one per login, i.e. one per signed-in device. */
async function startSession(res: Response, userId: string): Promise<void> {
  const { token, hash, expiresAt } = newRefreshToken();
  await db.createRefreshToken({ userId, familyId: crypto.randomUUID(), tokenHash: hash, expiresAt });
  setRefreshCookie(res, token);
}

function refreshCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: !config.isDev, sameSite: 'strict', path: REFRESH_COOKIE_PATH };
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, { ...refreshCookieOptions(), maxAge: config.jwt.refreshTtlMs });
}

function publicUser(user: { id: string; name: string; email: string; phone?: string }) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone };
}

export default router;
