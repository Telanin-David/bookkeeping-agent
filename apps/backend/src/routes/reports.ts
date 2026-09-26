import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireShopOwnership } from '../middleware/auth';
import { validate } from '../middleware/validation';
import * as db from '../services/db';
import { sendReportEmail } from '../services/email';

// PDF generation is fully implemented in Deliverable 7.
// These routes wire up the endpoint contract; the PDF builder is a stub.

const router = Router();
router.use(requireAuth);

const dateRangeSchema = z.object({
  shopId: z.string().uuid(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sendEmail: z.boolean().default(false),
});

// Report routes take the shop in the body; without this, any signed-in user could
// request (and have emailed to themselves) another owner's reports.
const ownShop = requireShopOwnership((req) => req.body?.shopId);

const receiptSchema = z.object({
  transactionId: z.string().uuid(),
  shopId: z.string().uuid(),
});

async function streamPdf(
  res: Response,
  filename: string,
  pdfBuffer: Buffer,
  sendToEmail: string | null,
  reportType: string,
): Promise<void> {
  if (sendToEmail) {
    await sendReportEmail(sendToEmail, reportType, pdfBuffer);
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdfBuffer);
}

router.post('/receipt', validate(receiptSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tx = await db.findTransactionById(req.body.transactionId, req.body.shopId, req.user!.id);
    if (!tx) { res.status(404).json({ error: 'NOT_FOUND', message: 'Transaction not found' }); return; }

    // TODO (Deliverable 7): generate real PDF from template
    const pdfBuffer = Buffer.from(`Receipt for transaction ${tx.id} — amount: ${tx.amount} ${tx.currency}`);
    await streamPdf(res, `receipt-${tx.date}.pdf`, pdfBuffer, null, 'Receipt');
  } catch (err) { next(err); }
});

router.post('/credit', validate(dateRangeSchema), ownShop, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shopId, dateFrom, dateTo, sendEmail } = req.body;
    const user = await db.findUserById(req.user!.id);

    // TODO (Deliverable 7): generate credit/receivables PDF
    const pdfBuffer = Buffer.from(`Credit report for shop ${shopId} from ${dateFrom} to ${dateTo}`);
    await streamPdf(res, `credit-report-${dateFrom}-${dateTo}.pdf`, pdfBuffer, sendEmail && user ? user.email : null, 'Credit');
  } catch (err) { next(err); }
});

router.post('/stock', validate(dateRangeSchema), ownShop, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shopId, dateFrom, dateTo, sendEmail } = req.body;
    const user = await db.findUserById(req.user!.id);

    // TODO (Deliverable 7): generate stock PDF
    const pdfBuffer = Buffer.from(`Stock report for shop ${shopId} from ${dateFrom} to ${dateTo}`);
    await streamPdf(res, `stock-report-${dateFrom}-${dateTo}.pdf`, pdfBuffer, sendEmail && user ? user.email : null, 'Stock');
  } catch (err) { next(err); }
});

router.post('/pl', validate(dateRangeSchema), ownShop, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shopId, dateFrom, dateTo, sendEmail } = req.body;
    const user = await db.findUserById(req.user!.id);

    // TODO (Deliverable 7): generate P&L PDF
    const pdfBuffer = Buffer.from(`P&L statement for shop ${shopId} from ${dateFrom} to ${dateTo}`);
    await streamPdf(res, `pl-statement-${dateFrom}-${dateTo}.pdf`, pdfBuffer, sendEmail && user ? user.email : null, 'P&L');
  } catch (err) { next(err); }
});

export default router;
