import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireShopOwnership } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import * as db from '../services/db';
import * as stock from '../services/stock';
import { checkDuplicateSafely, refreshDebtAlerts } from '../services/alerts';
import { categorizeTransaction } from '../services/claude';
import { todayIso } from '../utils/dates';

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
});

// Products sold (stock off the shelf) or bought (stock onto it) in this transaction.
const createSchema = baseSchema.extend({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive().max(1_000_000),
  })).max(50).optional(),
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
    const data = { shopId: req.params['shopId']!, userId: req.user!.id, ...fields, category, aiCategorized };
    const tx = items?.length
      ? await stock.createTransactionWithItems(data, items)
      : await db.createTransaction(data);
    await checkDuplicateSafely(tx);
    // A debt entered already past its due date is flagged straight away.
    if (tx.dueDate) await refreshDebtAlerts(tx.id);
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

const isDebt = (type: string) => type === 'receivable' || type === 'payable';
const amountText = (n: number) => n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

router.patch('/:transactionId', validate(updateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.params['shopId']!;
    const userId = req.user!.id;
    const txId = req.params['transactionId']!;
    const current = await db.findTransactionById(txId, shopId, userId);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');

    const { status, ...changes } = req.body as z.infer<typeof updateSchema>;
    if (isDebt(current.type) && current.amountPaid > 0) {
      if (changes.type && !isDebt(changes.type)) {
        throw new AppError(400, 'BAD_REQUEST', 'This debt has payments recorded, so it can’t be changed to a cash sale or expense. Remove the payments first.');
      }
      if (changes.amount !== undefined && changes.amount < current.amountPaid) {
        throw new AppError(400, 'BAD_REQUEST', `The amount can’t be less than what has already been paid (${amountText(current.amountPaid)}).`);
      }
    }

    if (changes.type && await stock.wouldFlipStock(txId, current.type, changes.type)) {
      throw new AppError(400, 'BAD_REQUEST', 'This transaction moved stock, so it can’t be switched between a sale and a purchase. Delete it and record it again.');
    }

    let tx = await db.updateTransaction(txId, shopId, userId, isDebt(current.type) ? changes : { ...changes, status });
    if (!tx) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    if (changes.date && changes.date !== current.date) await stock.moveTransactionItems(txId, changes.date);

    // A debt's status follows its payments. "Settled" pays off what's left today;
    // "pending" reopens it by removing its payments.
    if (isDebt(tx.type)) {
      if (status === 'settled' && tx.balance > 0) {
        const paid = await db.recordDebtPayment(txId, shopId, userId, { paidOn: todayIso(), today: todayIso() });
        if (paid.ok) tx = paid.transaction;
      } else if (status === 'pending' && tx.amountPaid > 0) {
        tx = (await db.removeDebtPayments(txId, shopId, userId))!.transaction;
      } else if (status === 'overdue' && tx.balance > 0) {
        tx = (await db.updateTransaction(txId, shopId, userId, { status: 'overdue' }))!;
      } else if (changes.amount !== undefined) {
        await db.resyncDebtStatus(txId);
        tx = (await db.findTransactionById(txId, shopId, userId))!;
      }
      await refreshDebtAlerts(txId);
      tx = (await db.findTransactionById(txId, shopId, userId))!;
    }
    res.json(tx);
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
    // Any stock the transaction moved goes back with it.
    const deleted = await stock.deleteTransactionWithStock(req.params['transactionId']!, req.params['shopId']!, req.user!.id);
    if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    await refreshDebtAlerts(req.params['transactionId']!); // closes any alert about it
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
