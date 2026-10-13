import { Request, Response, NextFunction } from 'express';
import { getEntitlements, lockedError, type Entitlements } from '../services/billing';
import type { Feature } from '../services/plans';

// One look-up per request, however many checks ask.
const cache = new WeakMap<Request, Promise<Entitlements>>();

/** What the signed-in owner's plan includes. Use after requireAuth. */
export function entitlementsFor(req: Request): Promise<Entitlements> {
  let found = cache.get(req);
  if (!found) {
    found = getEntitlements(req.user!.id);
    cache.set(req, found);
  }
  return found;
}

/**
 * Refuses with 402 PLAN_REQUIRED, and a plain explanation, when the owner's plan doesn't
 * include the feature. With billing off, every plan includes everything.
 */
export function requireFeature(feature: Feature) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const e = await entitlementsFor(req);
      next(e.features[feature] ? undefined : lockedError(feature));
    } catch (err) {
      next(err);
    }
  };
}
