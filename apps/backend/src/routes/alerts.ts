import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import * as db from '../services/db';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string ?? '1', 10);
    const limit = Math.min(parseInt(req.query['limit'] as string ?? '50', 10), 100);
    const result = await db.listAlerts(req.user!.id, {
      shopId: req.query['shopId'] as string | undefined,
      status: req.query['status'] as Parameters<typeof db.listAlerts>[1]['status'],
      page,
      limit,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string ?? '1', 10);
    const limit = Math.min(parseInt(req.query['limit'] as string ?? '50', 10), 100);
    // History returns all statuses — no status filter
    const result = await db.listAlerts(req.user!.id, { page, limit });
    res.json(result);
  } catch (err) { next(err); }
});

router.patch('/:alertId/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alert = await db.updateAlertStatus(req.params['alertId']!, req.user!.id, 'acknowledged');
    if (!alert) throw new AppError(404, 'NOT_FOUND', 'Alert not found');
    res.json(alert);
  } catch (err) { next(err); }
});

router.patch('/:alertId/dismiss', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alert = await db.updateAlertStatus(req.params['alertId']!, req.user!.id, 'dismissed');
    if (!alert) throw new AppError(404, 'NOT_FOUND', 'Alert not found');
    res.json(alert);
  } catch (err) { next(err); }
});

export default router;
