import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import * as billing from '../services/billing';
import { PaystackError } from '../services/paystack';
import { PAID_PLAN_IDS } from '../services/plans';

const router = Router();
router.use(requireAuth);

// Per signed-in owner: starting a payment talks to Paystack, so it isn't free to spam.
const limiter = (perMinute: number) => rateLimit({
  windowMs: 60_000, limit: perMinute, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.user!.id,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Try again in a minute.' },
});

const planSchema = z.object({ plan: z.enum(PAID_PLAN_IDS as [string, ...string[]]) });
const referenceSchema = z.object({ reference: z.string().min(6).max(100) });

/** The owner's plan, what's on offer, recent payments: everything the Plan screen shows. */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const entitlements = await billing.getEntitlements(userId);
    const [payments, passSpendKobo] = entitlements.billingEnabled
      ? await Promise.all([billing.listPayments(userId), billing.passSpendThisMonth(userId)])
      : [[], 0];
    res.json({ ...entitlements, offers: entitlements.billingEnabled ? billing.offers(entitlements.passesEnabled) : [], payments, passSpendKobo });
  } catch (err) { next(err); }
});

/** Starts paying for a plan: the reply's authorizationUrl is Paystack's payment page. */
router.post('/checkout', limiter(10), validate(planSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await billing.startCheckout(req.user!.id, req.body.plan));
  } catch (err) { next(err); }
});

/**
 * After Paystack sends the owner back: asks Paystack whether the money arrived. A bank
 * transfer can take a few minutes; 'pending' means ask again shortly.
 */
router.post('/verify', limiter(30), validate(referenceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let result: billing.Confirmation;
    try {
      result = await billing.confirmPaystackPayment(req.body.reference, req.user!.id);
    } catch (err) {
      if (err instanceof PaystackError) {
        console.error('[billing] verify failed:', err.message);
        throw new AppError(502, 'PAYMENTS_UNAVAILABLE', 'Couldn’t check with Paystack just now. If you paid, your plan will switch on by itself shortly.');
      }
      throw err;
    }
    if (result.status === 'not_found') throw new AppError(404, 'NOT_FOUND', 'Payment not found');
    res.json({ status: result.status, payment: result.payment, entitlements: await billing.getEntitlements(req.user!.id) });
  } catch (err) { next(err); }
});

export default router;

/**
 * Paystack's webhook (Settings → API Keys & Webhooks → Webhook URL:
 * https://<your API>/api/v1/billing/paystack/webhook). Mounted with express.raw before the
 * JSON parser, because the signature covers the exact bytes Paystack sent.
 */
export async function paystackWebhook(req: Request, res: Response): Promise<void> {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const outcome = await billing.handleWebhook(raw, req.headers['x-paystack-signature']);
    if (outcome === 'invalid') {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Bad signature' });
      return;
    }
    res.status(200).json({ received: true });
  } catch (err) {
    // Couldn't check with Paystack: answering with an error makes Paystack try again later.
    console.error('[billing] webhook failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Try again' });
  }
}
