import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import * as db from '../services/db';
import * as claudeService from '../services/claude';

const router = Router();
router.use(requireAuth);

const createSessionSchema = z.object({ shopId: z.string().uuid() });
const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  type: z.enum(['text', 'voice', 'image']).default('text'),
  mediaUrl: z.string().url().optional(),
});

router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string ?? '1', 10);
    const limit = Math.min(parseInt(req.query['limit'] as string ?? '20', 10), 50);
    const result = await db.listChatSessions(req.user!.id, req.query['shopId'] as string | undefined, page, limit);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/sessions', validate(createSessionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await db.createChatSession(req.user!.id, req.body.shopId);
    res.status(201).json(session);
  } catch (err) { next(err); }
});

router.get('/sessions/:sessionId/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string ?? '1', 10);
    const limit = Math.min(parseInt(req.query['limit'] as string ?? '50', 10), 100);
    const result = await db.listChatMessages(req.params['sessionId']!, page, limit);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/sessions/:sessionId/messages', validate(sendMessageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, type, mediaUrl } = req.body;
    const userMsg = await db.addChatMessage(req.params['sessionId']!, 'user', content, type, mediaUrl);

    // TODO (Deliverable 5): assemble full shop context before calling Claude
    const aiResponse = await claudeService.sendChatMessage(content, {
      shopName: 'Your Shop',
      currency: 'NGN',
      recentTransactions: [],
    });

    const assistantMsg = await db.addChatMessage(req.params['sessionId']!, 'assistant', aiResponse.reply);

    res.json({ userMessage: userMsg, assistantMessage: assistantMsg });
  } catch (err) { next(err); }
});

export default router;
