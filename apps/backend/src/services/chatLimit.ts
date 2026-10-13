import { getEntitlements, chatRefusal, type ChatAllowance } from './billing';
import { AppError } from '../middleware/errorHandler';

export type DailyUsage = ChatAllowance;

/** How many assistant messages this owner has left: today's, or for their trial or day pass. */
export async function getDailyUsage(userId: string): Promise<DailyUsage> {
  return (await getEntitlements(userId)).chat;
}

/** The error for a message over the owner's allowance, or null if it can go through. */
export async function chatAllowanceError(userId: string): Promise<AppError | null> {
  const e = await getEntitlements(userId);
  return e.chat.remaining === 0 ? chatRefusal(e) : null;
}

export function limitReachedMessage(limit: number): string {
  return `You've used today's ${limit} messages to the assistant. They start again at midnight. ` +
    'You can still record sales with the Add transaction form.';
}
