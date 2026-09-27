import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, requireShopOwnership } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import * as db from '../services/db';
import { saveFile } from '../services/storage';
import { detectKind, readSheet } from '../services/importParse';
import { buildTemplate, confirmImport, listImports, loadSheet, previewOf, undoImport, validateImport } from '../services/importer';

// Import from a spreadsheet (Deliverable 9): upload → preview with guessed columns →
// validate (check every row) → confirm (import) → undo if it was a mistake.

const router = Router();
router.use(requireAuth);

const MAX_FILE_BYTES = 5 * 1024 * 1024;

// The file's type is checked from its bytes after upload; the browser's claim isn't trusted.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1 } });

const uploadLimiter = rateLimit({
  windowMs: 60 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.user!.id,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many uploads. Try again in an hour.' },
});

const column = z.string().min(1).max(200).optional();
const mappingSchema = z.object({
  date: column, amount: column, moneyIn: column, moneyOut: column, description: column,
  type: column, counterparty: column, category: column, dueDate: column, paid: column,
  defaultType: z.enum(['sale', 'expense', 'receivable', 'payable', 'sign']).optional(),
});

function tooBig(err: unknown, _req: Request, _res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return next(new AppError(413, 'PAYLOAD_TOO_LARGE', 'The file is larger than 5 MB. Split it into smaller files.'));
  }
  next(err);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findJob(req: Request) {
  if (!UUID_RE.test(req.params['importId'] ?? '')) throw new AppError(404, 'NOT_FOUND', 'Import not found');
  const job = await db.findImportById(req.params['importId']!, req.user!.id);
  if (!job) throw new AppError(404, 'NOT_FOUND', 'Import not found');
  return job;
}

router.get('/template', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="bookkeeping-import-template.xlsx"');
    res.send(await buildTemplate());
  } catch (err) { next(err); }
});

router.get('/', requireShopOwnership((req) => req.query['shopId']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await listImports(req.query['shopId'] as string, req.user!.id) });
  } catch (err) { next(err); }
});

// shopId arrives as a multipart form field, so the ownership check runs after multer.
router.post('/upload', uploadLimiter, upload.single('file'), tooBig, requireShopOwnership((req) => req.body?.shopId),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError(400, 'BAD_REQUEST', 'Choose a file to upload.');
      const kind = detectKind(req.file.buffer);
      // readSheet explains unsupported files (.xls, images…) in plain words.
      const sheet = await readSheet(req.file.buffer).catch((err: Error) => { throw new AppError(422, 'UNPROCESSABLE_ENTITY', err.message); });
      if (sheet.headers.length === 0) {
        throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'We couldn’t find a header row (like Date, Item, Amount) in the first 10 rows of the first sheet.');
      }
      if (sheet.rows.length === 0) throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'The sheet has headers but no rows under them.');

      // The stored name is chosen here, never taken from the upload: a name like
      // "../../x" would otherwise write outside the upload folder.
      const filePath = await saveFile(req.file.buffer, `import-${crypto.randomUUID()}.${kind}`);
      const displayName = req.file.originalname.replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 200) || `upload.${kind}`;
      const job = await db.createImportJob(req.user!.id, req.body.shopId, displayName, filePath);
      res.status(201).json(previewOf(job, sheet));
    } catch (err) { next(err); }
  });

router.get('/:importId/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await findJob(req);
    res.json(previewOf(job, await loadSheet(job)));
  } catch (err) { next(err); }
});

router.post('/:importId/validate', validate(mappingSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await validateImport(await findJob(req), req.body));
  } catch (err) { next(err); }
});

router.post('/:importId/confirm', validate(z.object({ includeDuplicates: z.boolean().default(false) })), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await confirmImport(await findJob(req), { includeDuplicates: req.body.includeDuplicates }));
  } catch (err) { next(err); }
});

router.post('/:importId/undo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await undoImport(await findJob(req)));
  } catch (err) { next(err); }
});

export default router;
