import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, requireShopOwnership } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import * as db from '../services/db';
import { saveBrandingFile, deleteBrandingFile } from '../services/storage';
import type { BrandingKind } from '../types';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(2).max(150),
  type: z.enum(['retail', 'wholesale', 'services', 'food', 'other']),
  location: z.string().optional(),
  currency: z.string().default('NGN'),
});

const updateSchema = createSchema.partial();

const switchSchema = z.object({
  shopId: z.string().uuid(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shops = await db.listShops(req.user!.id);
    res.json({ data: shops });
  } catch (err) { next(err); }
});

router.post('/', validate(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = await db.createShop({ ownerId: req.user!.id, ...req.body });
    res.status(201).json(shop);
  } catch (err) { next(err); }
});

router.post('/switch', validate(switchSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = await db.findShopById(req.body.shopId, req.user!.id);
    if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');
    res.json({ activeShopId: shop.id });
  } catch (err) { next(err); }
});

router.get('/:shopId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = await db.findShopById(req.params['shopId']!, req.user!.id);
    if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');
    res.json(shop);
  } catch (err) { next(err); }
});

router.patch('/:shopId', validate(updateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = await db.updateShop(req.params['shopId']!, req.user!.id, req.body);
    if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');
    res.json(shop);
  } catch (err) { next(err); }
});


// ── Receipt branding (logo / signature) ─────────────────────────
const MAX_BRANDING_BYTES = 2 * 1024 * 1024;
const brandingUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BRANDING_BYTES, files: 1 } });
// Per signed-in owner, from docs/api/openapi.yaml.
const brandingLimiter = rateLimit({
  windowMs: 60 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.user!.id,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many image uploads. Try again in an hour.' },
});

/**
 * Identifies the image from its first bytes, not the name or Content-Type the browser
 * claims — only real PNG/JPEG/WebP files are stored, so nothing else can be served back.
 */
// PNG and JPEG only: those are the formats the PDF generator can embed on receipts.
// (The web app converts every chosen image to PNG before uploading anyway.)
function imageExtension(buf: Buffer): 'png' | 'jpg' | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  return null;
}

// Checked before the upload is read, so a foreign or malformed shop id costs nothing.
const ownShop = requireShopOwnership((req) => req.params['shopId']);

function brandingKind(value: string | undefined): BrandingKind {
  if (value === 'logo' || value === 'signature') return value;
  throw new AppError(404, 'NOT_FOUND', 'Endpoint not found');
}

router.put('/:shopId/branding/:kind', brandingLimiter, ownShop, (req: Request, res: Response, next: NextFunction) => {
  brandingUpload.single('file')(req, res, (uploadErr: unknown) => {
    void (async () => {
      try {
        if (uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE') {
          throw new AppError(400, 'BAD_REQUEST', 'That image is over 2 MB. Choose a smaller one.');
        }
        if (uploadErr) throw uploadErr;

        const kind = brandingKind(req.params['kind']);
        const shopId = req.params['shopId']!;
        if (!req.file) throw new AppError(400, 'BAD_REQUEST', 'No image provided');

        const ext = imageExtension(req.file.buffer);
        if (!ext) throw new AppError(400, 'BAD_REQUEST', 'Choose a PNG or JPG image.');

        // A new random name per upload: browsers can cache it forever, and a replaced
        // logo shows immediately because its URL changes.
        const key = `${shopId}-${kind}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
        await saveBrandingFile(key, req.file.buffer);
        const result = await db.setShopBranding(shopId, req.user!.id, kind, key);
        if (!result) {
          await deleteBrandingFile(key);
          throw new AppError(404, 'NOT_FOUND', 'Shop not found');
        }
        if (result.previousKey) await deleteBrandingFile(result.previousKey);
        res.json(result.shop);
      } catch (err) { next(err); }
    })();
  });
});

router.delete('/:shopId/branding/:kind', ownShop, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kind = brandingKind(req.params['kind']);
    const result = await db.setShopBranding(req.params['shopId']!, req.user!.id, kind, null);
    if (!result) throw new AppError(404, 'NOT_FOUND', 'Shop not found');
    if (result.previousKey) await deleteBrandingFile(result.previousKey);
    res.json(result.shop);
  } catch (err) { next(err); }
});

export default router;
