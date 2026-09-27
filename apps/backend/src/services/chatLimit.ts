import { config } from '../config';
import * as db from './db';
import { todayIso } from '../utils/dates';

export interface DailyUsage {
  used: number;
  /** null: no limit (turned off, or an admin). */
  limit: number | null;
  remaining: number | null;
}

/** How many assistant messages this owner has used today, and how many are left. */
export async function getDailyUsage(userId: string): Promise<DailyUsage> {
  const used = await db.countChatMessagesOn(userId, todayIso(), config.businessTimeZone);
  const limit = config.anthropic.chatDailyLimit;
  if (limit === 0 || (await db.isAdmin(userId))) return { used, limit: null, remaining: null };
  return { used, limit, remaining: Math.max(limit - used, 0) };
}

export function limitReachedMessage(limit: number): string {
  return `You've used today's ${limit} messages to the assistant. They start again at midnight. ` +
    'You can still record sales with the Add transaction form.';
}
