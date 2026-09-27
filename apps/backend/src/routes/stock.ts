import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireShopOwnership } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import * as stock from '../services/stock';
import { todayIso } from '../utils/dates';

const router = Router({ mergeParams: true });
router.use(requireAuth);
router.use(requireShopOwnership((req) => req.params['shopId']));

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const quantity = z.number().min(0).max(1_000_000);
const price = z.number().min(0).max(1_000_000_000);

const productFields = {
  name: z.string().trim().min(1, 'Enter a name').max(200),
  unit: z.string().trim().max(30).optional(),
  lowStockLevel: quantity.nullable().optional(),
  costPrice: price.nullable().optional(),
  sellingPrice: price.nullable().optional(),
};
const createProductSchema = z.object({ ...productFields, openingQuantity: quantity.optional() });
const updateProductSchema = z.object(productFields).partial();

const movementSchema = z.object({
  // restock: more came in. adjustment: damaged, expired, used, found… (+ or −).
  kind: z.enum(['restock', 'adjustment']),
  change: z.number().min(-1_000_000).max(1_000_000),
  occurredOn: isoDay.optional(),
  note: z.string().max(500).optional(),
});

const countSchema = z.object({
  items: z.array(z.object({ productId: z.string().uuid(), counted: quantity })).min(1).max(500),
  occurredOn: isoDay.optional(),
  note: z.string().max(500).optional(),
});

const shopId = (req: Request) => req.params['shopId']!;

router.get('/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await stock.listProducts(shopId(req), req.user!.id, {
      includeArchived: req.query['includeArchived'] === 'true',
      lowOnly: req.query['lowOnly'] === 'true',
      search: typeof req.query['search'] === 'string' ? req.query['search'] : undefined,
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/products', validate(createProductSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await stock.createProduct(shopId(req), req.user!.id, { ...req.body, today: todayIso() });
    res.status(201).json(product);
  } catch (err) { next(err); }
});

router.get('/products/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await stock.findProduct(req.params['productId']!, shopId(req), req.user!.id);
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    res.json(product);
  } catch (err) { next(err); }
});

router.patch('/products/:productId', validate(updateProductSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await stock.updateProduct(req.params['productId']!, shopId(req), req.user!.id, req.body);
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    res.json(product);
  } catch (err) { next(err); }
});

// Removes the product from the stock list; its history is kept for past sales and reports.
router.delete('/products/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const removed = await stock.archiveProduct(req.params['productId']!, shopId(req), req.user!.id);
    if (!removed) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    res.status(204).send();
  } catch (err) { next(err); }
});

router.get('/products/:productId/movements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await stock.listMovements(req.params['productId']!, shopId(req), req.user!.id);
    if (!data) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/products/:productId/movements', validate(movementSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = todayIso();
    const body = req.body as z.infer<typeof movementSchema>;
    const result = await stock.adjustStock(shopId(req), req.user!.id, req.params['productId']!, {
      ...body, occurredOn: body.occurredOn ?? today, today,
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

router.delete('/movements/:movementId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await stock.removeMovement(req.params['movementId']!, shopId(req), req.user!.id);
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Stock change not found');
    res.json(product);
  } catch (err) { next(err); }
});

// A shelf count: what is actually there. The reply says, per product, what the records
// expected and the difference (e.g. 2 missing).
router.post('/counts', validate(countSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = todayIso();
    const body = req.body as z.infer<typeof countSchema>;
    const data = await stock.recordShelfCount(shopId(req), req.user!.id, { ...body, occurredOn: body.occurredOn ?? today, today });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

export default router;
