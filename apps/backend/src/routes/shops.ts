import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import * as db from '../services/db';

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

export default router;
