import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { Transaction } from '../types';

// Full prompt engineering and context assembly is Deliverable 5.
// This module provides the interface the rest of the backend calls.

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

export interface ClaudeResponse {
  reply: string;
  extractedTransactions: Partial<Transaction>[];
}

export async function sendChatMessage(
  userMessage: string,
  _context: {
    shopName: string;
    currency: string;
    recentTransactions: Transaction[];
  },
): Promise<ClaudeResponse> {
  // TODO (Deliverable 5): replace with full system prompt + context assembly
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: userMessage }],
  });

  const reply = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  return { reply, extractedTransactions: [] };
}

export async function categorizeTransaction(description: string, type: string): Promise<string> {
  // TODO (Deliverable 5): full categorization logic with few-shot examples
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    messages: [{
      role: 'user',
      content: `Categorize this ${type} transaction into a short category name (max 4 words): "${description}". Reply with only the category name.`,
    }],
  });

  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim();
}
