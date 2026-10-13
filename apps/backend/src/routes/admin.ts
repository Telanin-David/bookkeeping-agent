import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminOnly } from '../middleware/auth';
import { validate } from '../middleware/validation';
import * as admin from '../services/admin';
import * as billing from '../services/billing';
import { PAID_PLAN_IDS, type PaidPlanId } from '../services/plans';

// The business dashboard. Only accounts made admin on the server (npm run make-admin) get
// in; to everyone else these paths don't exist.
const router = Router();
router.use(adminOnly);

router.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await admin.getOverview());
  } catch (err) { next(err); }
});

router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = typeof req.query['search'] === 'string' ? req.query['search'].slice(0, 100) : undefined;
    res.json(await admin.listUsers(new Date(), search));
  } catch (err) { next(err); }
});

// Money in: revenue, paying owners by plan, trials, recent payments.
router.get('/billing', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await billing.getBillingOverview());
  } catch (err) { next(err); }
});

// Offer the full-capacity Weekly and Day passes (the owner's "after 50 users" step).
router.put('/billing/passes', validate(z.object({ enabled: z.boolean() })), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await billing.setPassesEnabled(req.body.enabled, req.user!.id);
    res.json({ passesEnabled: await billing.passesEnabled() });
  } catch (err) { next(err); }
});

// Money an owner sent straight to the business's account: switches their plan on at once.
const manualSchema = z.object({
  plan: z.enum(PAID_PLAN_IDS as [string, ...string[]]),
  // Naira actually received; omit for the plan's price.
  amount: z.number().positive().max(10_000_000).optional(),
  note: z.string().max(300).optional(),
});

router.post('/users/:userId/payments', validate(manualSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await billing.recordManualPayment({
      adminId: req.user!.id,
      userId: req.params['userId']!,
      plan: req.body.plan as PaidPlanId,
      amountKobo: req.body.amount !== undefined ? Math.round(req.body.amount * 100) : undefined,
      note: req.body.note,
    });
    res.status(201).json(payment);
  } catch (err) { next(err); }
});

export default router;
