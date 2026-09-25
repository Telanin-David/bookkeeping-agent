import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import * as db from './db';
import { Transaction, TransactionType } from '../types';

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

// Opus 5 for the chat agent (accuracy matters — this creates real financial records).
// Haiku 4.5 for one-shot category classification, where speed/cost matter more.
const CHAT_MODEL = 'claude-opus-5';
const CATEGORIZE_MODEL = 'claude-haiku-4-5';

// Chat + a bounded tool loop; not "hard reasoning" work, so medium effort over high/xhigh.
const CHAT_EFFORT: Anthropic.Messages.OutputConfig['effort'] = 'medium';

// Guards against a runaway tool-calling loop driving up cost on a stuck conversation.
const MAX_TOOL_ITERATIONS = 6;

const TRANSACTION_TYPES = ['sale', 'expense', 'receivable', 'payable'] as const;

// Static across every request — the cache_control breakpoint below caches this
// (and the tools array, which renders before it) so only the small per-shop
// context block and the actual messages are paid for at full price each turn.
const SYSTEM_PROMPT = `You are the bookkeeping agent inside Bookkeeping AI, a chat-first app that helps small shop owners in Nigeria track their sales, expenses, and money owed to or by them — entirely through conversation, in plain everyday language, not accounting jargon.

## Recording transactions
When the owner describes something that happened — a sale, a purchase, money a customer owes, money owed to a supplier — call record_transaction. If a message describes several distinct transactions ("I sold rice and bought sugar"), call record_transaction once per transaction, not once for the whole message.

Never guess an amount or what was sold. If either is unclear, ask a short clarifying question instead of calling the tool. Resolve relative dates ("today", "yesterday", "last Tuesday") against the current date given below before calling the tool — record_transaction takes an explicit date, not a relative phrase.

After recording, confirm what was recorded in one short, natural sentence — don't recite every field back like a form.

## Answering questions about the shop's money
Never add up or estimate amounts yourself. For "how much did I make/spend", "what's my biggest expense", or anything needing a real total, call get_spending_summary and report its numbers. For "who owes me", "did I sell to X", or finding a specific past transaction, call find_transactions.

## Receipts and invoices
When the owner asks for a receipt or invoice ("give me a receipt for Mama Nkechi", "print an invoice for that credit sale"), first call find_transactions to locate the real transaction — never invent an id. Once you have identified the one transaction they mean, call show_receipt with its id, then briefly confirm what you're showing them.

## Tone
Warm, direct, and brief — the owner is running a shop, not reading a report. Use the shop's actual currency for every amount. If a request is genuinely outside what you can do here (it isn't about this shop's transactions), say so plainly.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'record_transaction',
    description: 'Record one sale, expense, receivable (a customer owes the shop), or payable (the shop owes a supplier) that the owner just described. Call once per distinct transaction.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: [...TRANSACTION_TYPES], description: 'sale = money coming in now; receivable = money coming in later (credit sale); expense = money going out now; payable = money going out later' },
        amount: { type: 'number', description: 'Positive amount, in the shop’s currency' },
        description: { type: 'string', description: 'What was sold or bought, e.g. "20 bags of rice"' },
        category: { type: 'string', description: 'Short category, e.g. Groceries, Rent, Wages. Omit to let the system categorize it automatically.' },
        counterparty: { type: 'string', description: 'Customer or supplier name, only if the owner actually named one' },
        date: { type: 'string', description: 'YYYY-MM-DD, resolved from any relative date the owner used. Omit to use today.' },
        dueDate: { type: 'string', description: 'YYYY-MM-DD. Only for receivable/payable, and only if a due date was mentioned or implied.' },
      },
      required: ['type', 'amount', 'description'],
      additionalProperties: false,
    },
  },
  {
    name: 'find_transactions',
    description: 'Search this shop’s real transaction history. Use this before answering any question about a specific past transaction, and before show_receipt — never guess a transaction id.',
    input_schema: {
      type: 'object',
      properties: {
        counterparty: { type: 'string', description: 'Customer or supplier name to search for (partial match)' },
        description: { type: 'string', description: 'Keyword to search the item/description for' },
        type: { type: 'string', enum: [...TRANSACTION_TYPES] },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_spending_summary',
    description: 'Get real totals for this shop over a date range — total by type and a breakdown by category. Always use this instead of adding up transactions yourself.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start date YYYY-MM-DD. Omit for 30 days before "to".' },
        to: { type: 'string', description: 'End date YYYY-MM-DD. Omit for today.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'show_receipt',
    description: 'Present a printable receipt or invoice for one specific transaction already confirmed to be the right one via find_transactions.',
    input_schema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string', description: 'The transaction’s real id, taken from a find_transactions result' },
      },
      required: ['transactionId'],
      additionalProperties: false,
    },
  },
];

export interface ChatContext {
  shopId: string;
  userId: string;
  shopName: string;
  shopType: string;
  currency: string;
}

export interface ClaudeChatResult {
  reply: string;
  extractedTransactionIds: string[];
  receiptTransactionId?: string;
}

interface ToolState {
  createdTransactionIds: string[];
  receiptTransactionId?: string;
}

function dynamicContext(ctx: ChatContext): string {
  return `Shop: ${ctx.shopName} (${ctx.shopType})\nCurrency: ${ctx.currency}\nToday's date: ${new Date().toISOString().slice(0, 10)}`;
}

function isTransactionType(value: unknown): value is TransactionType {
  return typeof value === 'string' && (TRANSACTION_TYPES as readonly string[]).includes(value);
}

async function executeTool(name: string, input: unknown, ctx: ChatContext, state: ToolState): Promise<unknown> {
  const args = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  switch (name) {
    case 'record_transaction': {
      const type = args['type'];
      const amount = args['amount'];
      const description = args['description'];
      if (!isTransactionType(type)) throw new Error(`type must be one of ${TRANSACTION_TYPES.join(', ')}`);
      if (typeof amount !== 'number' || !(amount > 0)) throw new Error('amount must be a positive number');
      if (typeof description !== 'string' || description.trim().length === 0) throw new Error('description is required');

      let category = typeof args['category'] === 'string' ? args['category'] : undefined;
      let aiCategorized = false;
      if (!category) {
        try {
          category = await categorizeTransaction(description, type);
          aiCategorized = true;
        } catch {
          // categorization failure is non-fatal — the transaction still gets recorded
        }
      }

      const tx = await db.createTransaction({
        shopId: ctx.shopId,
        userId: ctx.userId,
        type,
        amount,
        currency: ctx.currency,
        description,
        category,
        counterparty: typeof args['counterparty'] === 'string' ? args['counterparty'] : undefined,
        date: typeof args['date'] === 'string' ? args['date'] : new Date().toISOString().slice(0, 10),
        dueDate: typeof args['dueDate'] === 'string' ? args['dueDate'] : undefined,
        aiCategorized,
      });
      state.createdTransactionIds.push(tx.id);
      return tx;
    }

    case 'find_transactions': {
      const results = await db.searchTransactions(ctx.shopId, ctx.userId, {
        counterparty: typeof args['counterparty'] === 'string' ? args['counterparty'] : undefined,
        description: typeof args['description'] === 'string' ? args['description'] : undefined,
        type: isTransactionType(args['type']) ? args['type'] : undefined,
      });
      return { count: results.length, transactions: results };
    }

    case 'get_spending_summary': {
      const to = typeof args['to'] === 'string' ? args['to'] : new Date().toISOString().slice(0, 10);
      const from = typeof args['from'] === 'string'
        ? args['from']
        : new Date(new Date(to).getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
      return db.getSpendingSummary(ctx.shopId, ctx.userId, from, to);
    }

    case 'show_receipt': {
      const transactionId = args['transactionId'];
      if (typeof transactionId !== 'string') throw new Error('transactionId is required');
      const tx = await db.findTransactionById(transactionId, ctx.shopId, ctx.userId);
      if (!tx) throw new Error('No transaction with that id exists for this shop');
      state.receiptTransactionId = tx.id;
      return { shown: true, transaction: tx };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function sendChatMessage(ctx: ChatContext, history: Anthropic.MessageParam[]): Promise<ClaudeChatResult> {
  const messages: Anthropic.MessageParam[] = [...history];
  const state: ToolState = { createdTransactionIds: [] };

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 4096,
      output_config: { effort: CHAT_EFFORT },
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: dynamicContext(ctx) },
      ],
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === 'refusal') {
      return {
        reply: "I couldn't help with that one — could you rephrase it?",
        extractedTransactionIds: state.createdTransactionIds,
        receiptTransactionId: state.receiptTransactionId,
      };
    }

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      const reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      return {
        reply: reply || "I'm not sure how to respond to that — could you say it differently?",
        extractedTransactionIds: state.createdTransactionIds,
        receiptTransactionId: state.receiptTransactionId,
      };
    }

    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block): Promise<Anthropic.ToolResultBlockParam> => {
        try {
          const output = await executeTool(block.name, block.input, ctx, state);
          return { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(output) };
        } catch (err) {
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            is_error: true,
            content: err instanceof Error ? err.message : 'Tool failed',
          };
        }
      }),
    );
    messages.push({ role: 'user', content: toolResults });
  }

  return {
    reply: "That's a lot to work through in one go — could you break it into smaller messages?",
    extractedTransactionIds: state.createdTransactionIds,
    receiptTransactionId: state.receiptTransactionId,
  };
}

export async function categorizeTransaction(description: string, type: string): Promise<string> {
  const response = await client.messages.create({
    model: CATEGORIZE_MODEL,
    max_tokens: 20,
    messages: [{
      role: 'user',
      content: `Categorize this ${type} transaction into a short category name (max 4 words). Reply with only the category name, nothing else.

Examples:
"20 bags of rice" (sale) -> Groceries
"Shop rent for September" (expense) -> Rent
"Staff wages" (expense) -> Wages
"Transport to Lagos market" (expense) -> Transport
"5 cartons of Indomie noodles" (sale) -> Provisions

Transaction: "${description}" (${type})`,
    }],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}
