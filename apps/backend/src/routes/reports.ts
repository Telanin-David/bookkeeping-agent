import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, requireShopOwnership } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import * as db from '../services/db';
import { sendReportEmail } from '../services/email';
import { loadBrandingImage } from '../services/storage';
import * as stock from '../services/stock';
import { getProfitFigures } from '../services/profit';
import { renderReceipt, renderProfitAndLoss, renderCreditReport, renderStockReport, receiptNumber } from '../services/pdf';
import { todayIso } from '../utils/dates';
import type { Shop } from '../types';

const router = Router();
router.use(requireAuth);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const dateRangeSchema = z.object({
  shopId: z.string().uuid(),
  dateFrom: isoDate,
  dateTo: isoDate,
  sendEmail: z.boolean().default(false),
}).refine((b) => b.dateFrom <= b.dateTo, { message: 'The start date must be on or before the end date', path: ['dateFrom'] });

const receiptSchema = z.object({
  transactionId: z.string().uuid(),
  shopId: z.string().uuid(),
});

// Rate limits from docs/api/openapi.yaml, per signed-in owner.
const limiter = (perMinute: number) => rateLimit({
  windowMs: 60_000, limit: perMinute, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.user!.id,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many reports requested. Try again in a minute.' },
});

// Report routes take the shop in the body; without this, any signed-in user could
// request (and have emailed to themselves) another owner's reports.
const ownShop = requireShopOwnership((req) => req.body?.shopId);

async function loadShop(req: Request): Promise<Shop> {
  const shop = await db.findShopById(req.body.shopId, req.user!.id);
  if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');
  return shop;
}

function safeFilename(s: string): string {
  return s.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'report';
}

async function sendPdf(res: Response, filename: string, pdf: Buffer, emailTo: string | null, reportType: string) {
  if (emailTo) await sendReportEmail(emailTo, reportType, pdf);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store'); // financial documents: never cached by browsers or proxies
  res.send(pdf);
}

async function emailFor(req: Request): Promise<string | null> {
  if (!req.body.sendEmail) return null;
  const user = await db.findUserById(req.user!.id);
  return user?.email ?? null;
}

router.post('/receipt', limiter(30), validate(receiptSchema), ownShop, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = await loadShop(req);
    const tx = await db.findTransactionById(req.body.transactionId, shop.id, req.user!.id);
    if (!tx) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    if (tx.type === 'expense' || tx.type === 'payable') {
      throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'Receipts are for sales. This transaction is an expense.');
    }
    const [logo, signature] = await Promise.all([loadBrandingImage(shop.logoUrl), loadBrandingImage(shop.signatureUrl)]);
    const pdf = await renderReceipt(tx, shop, { logo, signature });
    await sendPdf(res, `${receiptNumber(tx)}.pdf`, pdf, null, 'Receipt');
  } catch (err) { next(err); }
});

router.post('/pl', limiter(10), validate(dateRangeSchema), ownShop, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = await loadShop(req);
    const { dateFrom, dateTo } = req.body;
    const [lines, profit, logo] = await Promise.all([
      db.getProfitAndLossLines(shop.id, req.user!.id, dateFrom, dateTo),
      getProfitFigures(shop.id, req.user!.id, dateFrom, dateTo),
      loadBrandingImage(shop.logoUrl),
    ]);
    const pdf = await renderProfitAndLoss({ shop, logo, from: dateFrom, to: dateTo, lines, profit });
    await sendPdf(res, `${safeFilename(shop.name)}-profit-and-loss-${dateFrom}-to-${dateTo}.pdf`, pdf, await emailFor(req), 'Profit & Loss');
  } catch (err) { next(err); }
});

router.post('/credit', limiter(10), validate(dateRangeSchema), ownShop, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = await loadShop(req);
    const { dateFrom, dateTo } = req.body;
    const userId = req.user!.id;
    const today = todayIso();
    // Balances at the end of the period — or today, if the period hasn't ended yet.
    const asOf = dateTo < today ? dateTo : today;
    const [receivables, payables, collected, paidOut, receivableTotalToday, payableTotalToday, logo] = await Promise.all([
      db.getDebtsAsOf(shop.id, userId, 'receivable', asOf),
      db.getDebtsAsOf(shop.id, userId, 'payable', asOf),
      db.getPaymentsInPeriod(shop.id, userId, 'receivable', dateFrom, dateTo),
      db.getPaymentsInPeriod(shop.id, userId, 'payable', dateFrom, dateTo),
      db.getOpenDebtTotal(shop.id, userId, 'receivable'),
      db.getOpenDebtTotal(shop.id, userId, 'payable'),
      loadBrandingImage(shop.logoUrl),
    ]);
    const pdf = await renderCreditReport({
      shop, logo, from: dateFrom, to: dateTo, asOf,
      receivables, payables, collected, paidOut, receivableTotalToday, payableTotalToday,
    });
    await sendPdf(res, `${safeFilename(shop.name)}-credit-report-${dateFrom}-to-${dateTo}.pdf`, pdf, await emailFor(req), 'Credit');
  } catch (err) { next(err); }
});

// Stock as of the end of the period (or today), with what came in, went out and went
// missing during it.
router.post('/stock', limiter(10), validate(dateRangeSchema), ownShop, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = await loadShop(req);
    const { dateFrom, dateTo } = req.body;
    const userId = req.user!.id;
    const today = todayIso();
    const asOf = dateTo < today ? dateTo : today;
    const [lines, counts, logo] = await Promise.all([
      stock.getStockReport(shop.id, userId, dateFrom, asOf),
      stock.getCountsInPeriod(shop.id, userId, dateFrom, dateTo),
      loadBrandingImage(shop.logoUrl),
    ]);
    const pdf = await renderStockReport({ shop, logo, from: dateFrom, to: dateTo, asOf, lines, counts });
    await sendPdf(res, `${safeFilename(shop.name)}-stock-report-${dateFrom}-to-${dateTo}.pdf`, pdf, await emailFor(req), 'Stock');
  } catch (err) { next(err); }
});

export default router;
