import { Router, Request, Response, NextFunction } from 'express';
import { adminOnly } from '../middleware/auth';
import * as admin from '../services/admin';

// The business dashboard. Only accounts made admin on the server (npm run make-admin) get
// in; to everyone else these paths don't exist.
const router = Router();
router.use(adminOnly);

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
