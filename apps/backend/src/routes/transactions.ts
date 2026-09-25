import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import * as db from '../services/db';
import { categorizeTransaction } from '../services/claude';

const router = Router({ mergeParams: true });
router.use(requireAuth);

const createSchema = z.object({
  type: z.enum(['sale', 'expense', 'receivable', 'payable']),
  amount: z.number().positive(),
  currency: z.string().default('NGN'),
  description: z.string().max(500).optional(),
  category: z.string().optional(),
  counterparty: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const updateSchema = createSchema.extend({
  status: z.enum(['pending', 'settled', 'overdue']).optional(),
}).partial();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string ?? '1', 10);
    const limit = Math.min(parseInt(req.query['limit'] as string ?? '50', 10), 200);
    const result = await db.listTransactions(req.params['shopId']!, req.user!.id, {
      type: req.query['type'] as Parameters<typeof db.listTransactions>[2]['type'],
      category: req.query['category'] as string | undefined,
      dateFrom: req.query['dateFrom'] as string | undefined,
      dateTo: req.query['dateTo'] as string | undefined,
      page,
      limit,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/', validate(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { category } = req.body;
    let aiCategorized = false;

    if (!category && req.body.description) {
      try {
        category = await categorizeTransaction(req.body.description, req.body.type);
        aiCategorized = true;
      } catch {
        // categorization failure is non-fatal
      }
    }

    const tx = await db.createTransaction({
      shopId: req.params['shopId']!,
      userId: req.user!.id,
      ...req.body,
      category,
      aiCategorized,
    });
    res.status(201).json(tx);
  } catch (err) { next(err); }
});

router.get('/:transactionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tx = await db.findTransactionById(req.params['transactionId']!, req.params['shopId']!, req.user!.id);
    if (!tx) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    res.json(tx);
  } catch (err) { next(err); }
});

router.patch('/:transactionId', validate(updateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tx = await db.updateTransaction(req.params['transactionId']!, req.params['shopId']!, req.user!.id, req.body);
    if (!tx) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    res.json(tx);
  } catch (err) { next(err); }
});

router.delete('/:transactionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await db.deleteTransaction(req.params['transactionId']!, req.params['shopId']!, req.user!.id);
    if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
