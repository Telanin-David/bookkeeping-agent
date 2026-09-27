import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireShopOwnership } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import * as db from '../services/db';
import { getMonthlyProfit, isMonth } from '../services/profit';
import { todayIso } from '../utils/dates';

const router = Router({ mergeParams: true });
router.use(requireAuth);
router.use(requireShopOwnership((req) => req.params['shopId']));

// One month's profit with feedback. ?month=YYYY-MM, this month by default.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = todayIso();
    const month = typeof req.query['month'] === 'string' ? req.query['month'] : today.slice(0, 7);
    if (!isMonth(month)) throw new AppError(400, 'BAD_REQUEST', 'Use a month like 2026-09.');
    if (month > today.slice(0, 7)) throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'That month hasn’t started yet.');
    const shop = await db.findShopById(req.params['shopId']!, req.user!.id);
    if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');
    res.json(await getMonthlyProfit(shop.id, req.user!.id, month, today, shop.currency));
  } catch (err) { next(err); }
});

export default router;
