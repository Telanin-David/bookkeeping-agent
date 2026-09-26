import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from './errorHandler';
import * as db from '../services/db';

interface AccessTokenPayload {
  sub: string;
  email: string;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authorization header missing'));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Token is expired or invalid'));
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
