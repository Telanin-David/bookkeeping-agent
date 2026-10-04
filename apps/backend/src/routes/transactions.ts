import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireShopOwnership } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import * as db from '../services/db';
import * as stock from '../services/stock';
import * as staff from '../services/staff';
import { checkDuplicateSafely, refreshDebtAlerts } from '../services/alerts';
import { categorizeTransaction } from '../services/claude';
import { todayIso } from '../utils/dates';
import { editTransaction, removeTransaction } from '../services/transactionChanges';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// Every route here is nested under /shops/:shopId — without this check, any signed-in
// user could write transactions into someone else's shop just by knowing its id.
router.use(requireShopOwnership((req) => req.params['shopId']));

const baseSchema = z.object({
  type: z.enum(['sale', 'expense', 'receivable', 'payable']),
  amount: z.number().positive(),
  currency: z.string().default('NGN'),
  description: z.string().max(500).optional(),
  category: z.string().optional(),
  counterparty: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Expenses and bills: goods to resell, or a running cost (rent, salaries, fuel…). Ignored on sales.
  costKind: z.enum(['stock', 'running']).optional(),
});

// Products sold (stock off the shelf) or bought (stock onto it) in this transaction.
const createSchema = baseSchema.extend({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive().max(1_000_000),
  })).max(50).optional(),
  // A salary payment: who it was for.
  staffId: z.string().uuid().optional(),
});

// Items can't be edited after the fact: delete the transaction and record it again.
const updateSchema = baseSchema.extend({
  status: z.enum(['pending', 'settled', 'overdue']).optional(),
}).partial();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string ?? '1', 10);
    const limit = Math.min(parseInt(req.query['limit'] as string ?? '50', 10), 200);
    const result = await db.listTransactions(req.params['shopId']!, req.user!.id, {
      type: req.query['type'] as Parameters<typeof db.listTransactions>[2]['type'],
      status: req.query['status'] as Parameters<typeof db.listTransactions>[2]['status'],
      category: req.query['category'] as string | undefined,
      costKind: ['stock', 'running'].includes(req.query['costKind'] as string) ? req.query['costKind'] as 'stock' | 'running' : undefined,
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

    const { items, ...fields } = req.body as z.infer<typeof createSchema>;
    if (fields.staffId && !(await staff.findStaff(fields.staffId, req.params['shopId']!, req.user!.id))) {
      throw new AppError(404, 'NOT_FOUND', 'Staff member not found');
    }
    const data = { shopId: req.params['shopId']!, userId: req.user!.id, ...fields, category, aiCategorized };
    const tx = items?.length
      ? await stock.createTransactionWithItems(data, items)
      : await db.createTransaction(data);
    await checkDuplicateSafely(tx);
    // A debt entered already past its due date is flagged straight away.
    if (tx.dueDate) await refreshDebtAlerts(tx.id);
    if (tx.staffId) await staff.refreshSalaryAlerts(tx.shopId);
    res.status(201).json({ ...tx, items: items?.length ? await stock.getTransactionItems(tx.id) : [] });
  } catch (err) { next(err); }
});

router.get('/:transactionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tx = await db.findTransactionById(req.params['transactionId']!, req.params['shopId']!, req.user!.id);
    if (!tx) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    res.json({ ...tx, items: await stock.getTransactionItems(tx.id) });
  } catch (err) { next(err); }
});

const amountText = (n: number) => n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

router.patch('/:transactionId', validate(updateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, ...changes } = req.body as z.infer<typeof updateSchema>;
    const { after } = await editTransaction(req.params['transactionId']!, req.params['shopId']!, req.user!.id, changes, status);
    res.json(after);
  } catch (err) { next(err); }
});

// ── Payments towards a debt (credit sale or bill on credit) ──────
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const paymentSchema = z.object({
  // Omit to pay off everything still owed.
  amount: z.number().positive().optional(),
  // Omit for today.
  paidOn: isoDay.optional(),
});

router.get('/:transactionId/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tx = await db.findTransactionById(req.params['transactionId']!, req.params['shopId']!, req.user!.id);
    if (!tx) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    res.json({ data: await db.listDebtPayments(tx.id, tx.shopId, req.user!.id) });
  } catch (err) { next(err); }
});

router.post('/:transactionId/payments', validate(paymentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = todayIso();
    const result = await db.recordDebtPayment(req.params['transactionId']!, req.params['shopId']!, req.user!.id, {
      amount: req.body.amount, paidOn: req.body.paidOn ?? today, today,
    });
    if (!result.ok) {
      switch (result.reason) {
        case 'not_found':      throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
        case 'not_a_debt':     throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'Payments can only be recorded against a credit sale or a bill on credit.');
        case 'already_paid':   throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'This debt is already fully paid.');
        case 'more_than_owed': throw new AppError(422, 'UNPROCESSABLE_ENTITY', `That’s more than is still owed. The most you can record is ${amountText(result.balance)}.`, [{ field: 'amount', message: String(result.balance) }]);
        case 'before_debt':    throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'The payment date can’t be before the debt was recorded.');
        case 'in_future':      throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'The payment date can’t be in the future.');
      }
    }
    await refreshDebtAlerts(result.transaction.id);
    res.status(201).json({ transaction: (await db.findTransactionById(result.transaction.id, result.transaction.shopId, req.user!.id))!, payment: result.payment });
  } catch (err) { next(err); }
});

router.delete('/:transactionId/payments/:paymentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.removeDebtPayments(req.params['transactionId']!, req.params['shopId']!, req.user!.id, req.params['paymentId']!);
    if (!result || result.removed === 0) throw new AppError(404, 'NOT_FOUND', 'Payment not found');
    await refreshDebtAlerts(result.transaction.id);
    res.json((await db.findTransactionById(result.transaction.id, result.transaction.shopId, req.user!.id))!);
  } catch (err) { next(err); }
});

router.delete('/:transactionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await removeTransaction(req.params['transactionId']!, req.params['shopId']!, req.user!.id);
    if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
