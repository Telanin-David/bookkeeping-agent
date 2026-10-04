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
    const shop = await db.findShopById(req.body.shopId, req.user!.id);
    if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');
    const session = await db.createChatSession(req.user!.id, req.body.shopId);
    res.status(201).json(session);
  } catch (err) { next(err); }
});

router.get('/sessions/:sessionId/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string ?? '1', 10);
    const limit = Math.min(parseInt(req.query['limit'] as string ?? '50', 10), 100);
    const session = await db.findChatSessionById(req.params['sessionId']!, req.user!.id);
    if (!session) throw new AppError(404, 'NOT_FOUND', 'Chat session not found');
    const result = await db.listChatMessages(req.params['sessionId']!, page, limit);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/sessions/:sessionId/messages', validate(sendMessageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, type, mediaUrl } = req.body;
    const userId = req.user!.id;

    const session = await db.findChatSessionById(req.params['sessionId']!, userId);
    if (!session) throw new AppError(404, 'NOT_FOUND', 'Chat session not found');
    const shop = await db.findShopById(session.shopId, userId);
    if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');

    // Read history before saving the new message so it isn't sent to Claude twice.
    const history = await db.listRecentChatMessages(session.id, 20);
    const userMsg = await db.addChatMessage(session.id, 'user', content, type, mediaUrl);

    let turn: claudeService.ChatTurnResult;
    try {
      turn = await claudeService.runChatTurn({ shop, userId, history, userMessage: content });
    } catch (err) {
      if (err instanceof claudeService.ClaudeUnavailableError) {
        console.error('Claude unavailable:', err.message);
        throw new AppError(503, 'AI_UNAVAILABLE', 'The assistant is temporarily unavailable. Your message was saved — please try again.');
      }
      throw err;
    }

    const assistantMsg = await db.addChatMessage(session.id, 'assistant', turn.reply, 'text', undefined, {
      extractedTransactionIds: turn.extractedTransactions.map((t) => t.id),
      receiptTransactionId: turn.receiptTransactionId,
    });

    res.json({
      userMessage: userMsg,
      assistantMessage: { ...assistantMsg, extractedTransactions: turn.extractedTransactions },
    });
  } catch (err) { next(err); }
});

export default router;
