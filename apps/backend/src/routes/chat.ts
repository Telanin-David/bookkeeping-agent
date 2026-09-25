import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
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

// How much prior conversation to replay as context on each turn.
const HISTORY_LIMIT = 30;

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
    const session = await db.findChatSessionById(req.params['sessionId']!, req.user!.id);
    if (!session) throw new AppError(404, 'NOT_FOUND', 'Chat session not found');

    const page = parseInt(req.query['page'] as string ?? '1', 10);
    const limit = Math.min(parseInt(req.query['limit'] as string ?? '50', 10), 100);
    const result = await db.listChatMessages(session.id, page, limit);

    // The spec's ChatMessage carries extractedTransactions (full objects), not the raw
    // id list db.ts stores internally — expand it here, same as the send-message route.
    const allIds = [...new Set(result.data.flatMap((m) => m.extractedTransactionIds))];
    const transactions = await db.findTransactionsByIds(allIds, session.shopId, req.user!.id);
    const byId = new Map(transactions.map((t) => [t.id, t]));

    res.json({
      ...result,
      data: result.data.map((m) => ({
        ...m,
        extractedTransactions: m.extractedTransactionIds.map((id) => byId.get(id)).filter(Boolean),
      })),
    });
  } catch (err) { next(err); }
});

router.post('/sessions/:sessionId/messages', validate(sendMessageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await db.findChatSessionById(req.params['sessionId']!, req.user!.id);
    if (!session) throw new AppError(404, 'NOT_FOUND', 'Chat session not found');

    const shop = await db.findShopById(session.shopId, req.user!.id);
    if (!shop) throw new AppError(404, 'NOT_FOUND', 'Shop not found');

    const { content, type, mediaUrl } = req.body;
    const userMsg = await db.addChatMessage(session.id, 'user', content, type, mediaUrl);

    const priorMessages = await db.listChatMessages(session.id, 1, HISTORY_LIMIT);
    const history: Anthropic.MessageParam[] = priorMessages.data.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const result = await claudeService.sendChatMessage(
      {
        shopId: shop.id,
        userId: req.user!.id,
        shopName: shop.name,
        shopType: shop.type,
        currency: shop.currency,
      },
      history,
    );

    const assistantMsg = await db.addChatMessage(session.id, 'assistant', result.reply, 'text', undefined, {
      extractedTransactionIds: result.extractedTransactionIds,
      receiptTransactionId: result.receiptTransactionId,
    });

    const extractedTransactions = result.extractedTransactionIds.length > 0
      ? await db.findTransactionsByIds(result.extractedTransactionIds, shop.id, req.user!.id)
      : [];

    res.json({
      userMessage: userMsg,
      assistantMessage: { ...assistantMsg, extractedTransactions },
    });
  } catch (err) { next(err); }
});

export default router;
