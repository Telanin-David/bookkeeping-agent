import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from './errorHandler';
import * as db from '../services/db';
import { todayIso } from '../utils/dates';

interface AccessTokenPayload {
  sub: string;
  email: string;
  sid?: string;
}

/**
 * Verifies the access token, then checks its device session is still signed in — so
 * "Sign out" (or a detected stolen refresh token) cuts the device off at once instead of
 * leaving its access token usable until it expires. Costs one indexed lookup per request.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authorization header missing'));
  }

  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(header.slice(7), config.jwt.accessSecret) as AccessTokenPayload;
  } catch {
    return next(new AppError(401, 'UNAUTHORIZED', 'Token is expired or invalid'));
  }

  try {
    // Tokens issued before sessions were tracked carry no sid; a 401 makes the app
    // refresh, which issues one that does.
    if (!payload.sid || !(await db.isSessionActive(payload.sid, payload.sub))) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Session has ended. Please log in again.'));
    }
    req.user = { id: payload.sub, email: payload.email };
    await markActive(payload.sub);
    next();
  } catch (err) {
    next(err);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Rejects the request with 404 unless the shop it names belongs to the signed-in user.
 * `getShopId` says where the id lives (URL param, JSON body, form field). Use after
 * requireAuth — and, for multipart uploads, after the body parser.
 */
export function requireShopOwnership(getShopId: (req: Request) => unknown) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = getShopId(req);
      // A malformed id can't be anyone's shop; checking here also keeps it out of the
      // uuid-typed query, where Postgres would reject it as a 500.
      if (typeof shopId !== 'string' || !UUID_RE.test(shopId)) {
        throw new AppError(404, 'NOT_FOUND', 'Shop not found');
      }
      const shop = await db.findShopById(shopId, req.user!.id);
      if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');
      next();
    } catch (err) { next(err); }
  };
}

// Users already marked active today, so it costs one write per user per day, not per request.
let activeDay = '';
const activeToday = new Set<string>();

async function markActive(userId: string): Promise<void> {
  const today = todayIso();
  if (today !== activeDay) { activeDay = today; activeToday.clear(); }
  if (activeToday.has(userId)) return;
  try {
    await db.markActiveDay(userId, today);
    activeToday.add(userId);
  } catch (err) {
    // Only the dashboard's numbers depend on this; never block the owner over it.
    console.error('Could not record activity:', err instanceof Error ? err.message : err);
  }
}

// Exactly what the server sends for a path that doesn't exist.
const notFound = () => new AppError(404, 'NOT_FOUND', 'Endpoint not found');

/**
 * For the business dashboard, which owners shouldn't know exists: anyone but an admin,
 * signed in or not, gets the same 404 as a path that isn't there. The one exception is an
 * expired sign-in, which gets the usual 401 so an admin's app can refresh it and carry on;
 * that only tells someone who was already signed in that the path needs a sign-in.
 */
export async function adminOnly(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(notFound());
  try {
    jwt.verify(header.slice(7), config.jwt.accessSecret);
  } catch (err) {
    return next(err instanceof jwt.TokenExpiredError
      ? new AppError(401, 'UNAUTHORIZED', 'Token is expired or invalid')
      : notFound());
  }
  await requireAuth(req, res, async (err?: unknown) => {
    if (err) return next(err instanceof AppError && err.statusCode === 401 ? notFound() : err);
    try {
      next((await db.isAdmin(req.user!.id)) ? undefined : notFound());
    } catch (e) {
      next(e);
    }
  });
}
