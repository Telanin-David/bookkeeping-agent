import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import * as db from '../services/db';

const router = Router();
router.use(requireAuth);

const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour)');

const alertSettingsSchema = z.object({
  emailAlerts: z.boolean().optional(),
  quietStart: clockTime.optional(),
  quietEnd: clockTime.optional(),
});

router.get('/alert-settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await db.getAlertSettings(req.user!.id);
    if (!settings) throw new AppError(404, 'NOT_FOUND', 'User not found');
    res.json(settings);
  } catch (err) { next(err); }
});

router.patch('/alert-settings', validate(alertSettingsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await db.updateAlertSettings(req.user!.id, req.body);
    if (!settings) throw new AppError(404, 'NOT_FOUND', 'User not found');
    res.json(settings);
  } catch (err) { next(err); }
});

export default router;
