import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { config } from '../config';
import { validate } from '../middleware/validation';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import * as db from '../services/db';

const router = Router();

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d])/,
    'Password must contain uppercase, lowercase, digit, and special character',
  ),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/signup', validate(signupSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, phone, password } = req.body;
    const existing = await db.findUserByEmail(email);
    if (existing) throw new AppError(409, 'CONFLICT', 'Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.createUser({ name, email, phone, passwordHash });

    const accessToken = signAccessToken(user.id, user.email);
    const { refreshToken, hash, expiresAt } = generateRefreshToken();
    await db.updateRefreshToken(user.id, hash, expiresAt);

    setRefreshCookie(res, refreshToken);
    res.status(201).json({ accessToken, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const user = await db.findUserByEmail(email);

    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      throw new AppError(429, 'TOO_MANY_REQUESTS', 'Account locked. Try again in 15 minutes.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await db.incrementLoginAttempts(email);
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
    }

    await db.resetLoginAttempts(email);
    const accessToken = signAccessToken(user.id, user.email);
    const { refreshToken, hash, expiresAt } = generateRefreshToken();
    await db.updateRefreshToken(user.id, hash, expiresAt);

    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token: string | undefined = req.cookies?.['refresh_token'];
    if (!token) throw new AppError(401, 'UNAUTHORIZED', 'Refresh token missing');

    const payload = jwt.verify(token, config.jwt.refreshSecret) as { sub: string; email: string };
    const user = await db.findUserById(payload.sub);
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'User not found');

    const accessToken = signAccessToken(user.id, user.email);
    const { refreshToken, hash, expiresAt } = generateRefreshToken();
    await db.updateRefreshToken(user.id, hash, expiresAt);

    setRefreshCookie(res, refreshToken);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.updateRefreshToken(req.user!.id, null, null);
    res.clearCookie('refresh_token');
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

function generateRefreshToken(): { refreshToken: string; hash: string; expiresAt: Date } {
  const refreshToken = jwt.sign({}, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return { refreshToken, hash, expiresAt };
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: !config.isDev,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function publicUser(user: { id: string; name: string; email: string; phone?: string }) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone };
}

export default router;
