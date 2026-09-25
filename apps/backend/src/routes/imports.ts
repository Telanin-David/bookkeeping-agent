import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import * as db from '../services/db';
import { saveFile } from '../services/storage';

// Full validation pipeline is Deliverable 9.
// These routes wire up the upload/preview/validate/confirm contract.

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/vnd.ms-excel'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const columnMappingSchema = z.object({
  date: z.string().optional(),
  amount: z.string().optional(),
  description: z.string().optional(),
  type: z.string().optional(),
  counterparty: z.string().optional(),
  category: z.string().optional(),
});

router.post('/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError(400, 'BAD_REQUEST', 'No file provided or unsupported file type');
    const { shopId } = req.body;
    if (!shopId) throw new AppError(400, 'BAD_REQUEST', 'shopId is required');

    const filename = `${Date.now()}-${req.file.originalname}`;
    const filePath = await saveFile(req.file.buffer, filename);

    const job = await db.createImportJob(req.user!.id, shopId, req.file.originalname, filePath);
    res.status(202).json(job);
  } catch (err) { next(err); }
});

router.get('/:importId/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await db.findImportById(req.params['importId']!, req.user!.id);
    if (!job) throw new AppError(404, 'NOT_FOUND', 'Import job not found');

    // TODO (Deliverable 9): read file and detect column types
    res.json({
      importId: job.id,
      detectedColumns: [],
      previewRows: [],
    });
  } catch (err) { next(err); }
});

router.post('/:importId/validate', validate(columnMappingSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await db.findImportById(req.params['importId']!, req.user!.id);
    if (!job) throw new AppError(404, 'NOT_FOUND', 'Import job not found');

    await db.updateImportJob(job.id, { status: 'validating', columnMapping: req.body });

    // TODO (Deliverable 9): run row-level validation
    await db.updateImportJob(job.id, { status: 'validated', validRows: 0, errorRows: 0, qualityScore: 0, errorLog: [] });

    res.json({ importId: job.id, totalRows: 0, validRows: 0, errorRows: 0, qualityScore: 0, errors: [] });
  } catch (err) { next(err); }
});

router.post('/:importId/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await db.findImportById(req.params['importId']!, req.user!.id);
    if (!job) throw new AppError(404, 'NOT_FOUND', 'Import job not found');
    if (job.status === 'confirmed') throw new AppError(409, 'CONFLICT', 'Import already confirmed');
    if (job.status !== 'validated') throw new AppError(400, 'BAD_REQUEST', 'Run validation before confirming');

    // TODO (Deliverable 9): ingest validated rows
    await db.updateImportJob(job.id, { status: 'confirmed' });

    res.json({ importId: job.id, rowsIngested: 0, rowsSkipped: 0, detectedPatterns: {} });
  } catch (err) { next(err); }
});

export default router;
