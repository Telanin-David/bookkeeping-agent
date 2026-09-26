import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from './errorHandler';
import * as db from '../services/db';

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
