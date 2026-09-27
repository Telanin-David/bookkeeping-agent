import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import * as admin from '../services/admin';

// The business dashboard. Only accounts made admin on the server (npm run make-admin) get in.
const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await admin.getOverview());
  } catch (err) { next(err); }
});

router.get('/users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await admin.listUsers());
  } catch (err) { next(err); }
});

export default router;
