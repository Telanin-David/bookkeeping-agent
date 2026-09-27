import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireShopOwnership } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import * as staff from '../services/staff';
import { todayIso } from '../utils/dates';

// Optional: only owners who pay people use any of this.
const router = Router({ mergeParams: true });
router.use(requireAuth);
router.use(requireShopOwnership((req) => req.params['shopId']));

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const pay = z.number().positive().max(1_000_000_000);

const fields = {
  name: z.string().trim().min(1, 'Enter a name').max(100),
  role: z.string().trim().max(100).nullable().optional(),
  monthlyPay: pay.nullable().optional(),
  payDay: z.number().int().min(1).max(31).nullable().optional(),
};
const createSchema = z.object(fields);
const updateSchema = z.object(fields).partial();
const paySchema = z.object({
  date: isoDay.optional(),
  payments: z.array(z.object({ staffId: z.string().uuid(), amount: pay })).min(1).max(100),
});

const shopId = (req: Request) => req.params['shopId']!;

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await staff.listStaff(shopId(req), req.user!.id) });
  } catch (err) { next(err); }
});

router.post('/', validate(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await staff.createStaff(shopId(req), req.user!.id, req.body));
  } catch (err) { next(err); }
});

// Records a salary expense for each person, all together (a running cost, category Salaries).
router.post('/pay', validate(paySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = todayIso();
    const body = req.body as z.infer<typeof paySchema>;
    const data = await staff.paySalaries(shopId(req), req.user!.id, { ...body, date: body.date ?? today, today });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.patch('/:staffId', validate(updateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await staff.updateStaff(req.params['staffId']!, shopId(req), req.user!.id, req.body);
    if (!updated) throw new AppError(404, 'NOT_FOUND', 'Staff member not found');
    res.json(updated);
  } catch (err) { next(err); }
});

// Someone who has left: off the list, their past salary payments kept.
router.delete('/:staffId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const removed = await staff.archiveStaff(req.params['staffId']!, shopId(req), req.user!.id);
    if (!removed) throw new AppError(404, 'NOT_FOUND', 'Staff member not found');
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
