import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { config } from '../config';
import * as db from './db';
import { Shop, Transaction, TransactionType, FinancialSummary, ChatMessage } from '../types';

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

// ── Categories ────────────────────────────────────────────────
// A fixed list keeps reports groupable; free-text categories from the model drift
// ("Rice purchase", "Stock", "Inventory restock") and make P&L grouping useless.
export const CATEGORIES: Record<TransactionType, readonly string[]> = {
  sale: ['Product Sales', 'Service Income', 'Other Income'],
  expense: [
    'Inventory', 'Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies',
    'Repairs & Maintenance', 'Marketing', 'Bank & Mobile Money Fees', 'Taxes & Levies', 'Other Expenses',
  ],
  receivable: ['Customer Credit', 'Other Receivable'],
  payable: ['Supplier Credit', 'Loan', 'Other Payable'],
};

const ALL_CATEGORIES = [...new Set(Object.values(CATEGORIES).flat())];
const FALLBACK_CATEGORY: Record<TransactionType, string> = {
  sale: 'Other Income',
  expense: 'Other Expenses',
  receivable: 'Other Receivable',
  payable: 'Other Payable',
};

export function normalizeCategory(type: TransactionType, category: string | null | undefined): string {
  const match = CATEGORIES[type].find((c) => c.toLowerCase() === category?.trim().toLowerCase());
  return match ?? FALLBACK_CATEGORY[type];
}

// ── System prompt ─────────────────────────────────────────────
// Kept byte-stable so it caches; everything per-shop or per-day goes in the context block after it.
export const SYSTEM_PROMPT = `You are the bookkeeping assistant inside a chat app for small shop owners, mostly in Nigeria and West Africa. Owners tell you what happened in their shop in everyday language — sometimes in Nigerian Pidgin or mixed with Yoruba, Igbo or Hausa words — and you keep their books accurate.

What you do:
- Record sales, expenses, credit given to customers (receivables) and credit taken from suppliers (payables) with the record_transaction tool.
- Mark a credit as paid with settle_transaction when the owner says a customer paid what they owed, or that they paid a supplier back. Settling an existing credit is not a new sale or expense; recording it as one would count the money twice.
- Answer questions about their numbers with get_financial_summary and find_transactions. Never state a figure you did not get from a tool or from the shop context.
- When the owner asks for a receipt, find the transaction and call show_receipt so the app can display it.

Recording rules:
- Record only things that already happened. Plans ("I go buy goods tomorrow") are not transactions.
- Amounts are in the shop's currency. If the owner names a different currency, ask how much it was in the shop's currency instead of converting it yourself.
- "Sold 20 bags of rice for 8000" means 8000 in total. "At 8000 each" or "8000 per bag" means a unit price — multiply and say the total you recorded. If you can't tell which one they mean, ask.
- If the amount or what kind of transaction it was is unclear, ask one short question instead of guessing. Do not invent amounts, names or dates.
- Use today's date from the shop context unless the owner says otherwise ("yesterday", "last Friday"); work out the actual date.
- Sold on credit / customer will pay later → receivable. Bought on credit / we will pay later → payable. Add a due date only if the owner gave one.
- Pick the category from the list in the tool. Put the item, quantity and unit price (if given) in the description, and the customer's or supplier's name in counterparty.
- Before recording, compare with the recent transactions in the shop context. If an identical one is already there for today, ask whether it's a new transaction or the same one again.
- One message can describe several transactions; record each one.

How you reply:
- Reply in the language and tone the owner used. Keep it short — this is a phone chat, not a report.
- After recording, confirm what you saved in one line per transaction, with the amount formatted in the shop's currency (for example ₦8,000).
- No markdown headings or tables. Short lists are fine when you are summarising several figures.
- You are not a tax adviser or an accountant. For tax filing or legal questions, give general information and suggest they confirm with a professional.`;

// ── Tools ─────────────────────────────────────────────────────
const nullableString = (description: string) => ({ anyOf: [{ type: 'string' }, { type: 'null' }], description });
const nullableDate = (description: string) => ({ anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }], description });

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'record_transaction',
    description: 'Save one transaction to the shop\'s books. Call once per transaction. Returns the saved transaction, including its id.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'amount', 'description', 'category', 'counterparty', 'date', 'due_date'],
      properties: {
        type: {
          type: 'string',
          enum: ['sale', 'expense', 'receivable', 'payable'],
          description: 'sale = money received for goods/services now; expense = money paid out now; receivable = customer owes the shop; payable = shop owes a supplier or lender.',
        },
        amount: { type: 'number', description: 'Total amount in the shop currency. Must be greater than 0.' },
        description: { type: 'string', description: 'What it was for, e.g. "20 bags of rice @ 400".' },
        category: { type: 'string', enum: ALL_CATEGORIES, description: 'Must be one of the categories listed for this transaction type in the system prompt\'s shop context.' },
        counterparty: nullableString('Customer or supplier name, or null if not mentioned.'),
        date: { type: 'string', format: 'date', description: 'Date it happened, YYYY-MM-DD.' },
        due_date: nullableDate('Only for receivable/payable when the owner gave a due date; otherwise null.'),
      },
    },
  },
  {
    name: 'settle_transaction',
    description: 'Mark an existing receivable or payable as paid. Use find_transactions first to get its id.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['transaction_id'],
      properties: {
        transaction_id: { type: 'string', format: 'uuid' },
      },
    },
  },
  {
    name: 'find_transactions',
    description: 'Search the shop\'s transactions, newest first. All filters are optional (pass null to skip one).',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['search', 'type', 'status', 'date_from', 'date_to'],
      properties: {
        search: nullableString('Text to match in the description or counterparty name.'),
        type: { anyOf: [{ type: 'string', enum: ['sale', 'expense', 'receivable', 'payable'] }, { type: 'null' }] },
        status: { anyOf: [{ type: 'string', enum: ['pending', 'settled', 'overdue'] }, { type: 'null' }] },
        date_from: nullableDate('Inclusive start date, YYYY-MM-DD.'),
        date_to: nullableDate('Inclusive end date, YYYY-MM-DD.'),
      },
    },
  },
  {
    name: 'get_financial_summary',
    description: 'Totals for a date range: sales, expenses, net profit, outstanding receivables/payables and overdue receivables. Pass null for both dates to cover all time.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['date_from', 'date_to'],
      properties: {
        date_from: nullableDate('Inclusive start date, YYYY-MM-DD.'),
        date_to: nullableDate('Inclusive end date, YYYY-MM-DD.'),
      },
    },
  },
  {
    name: 'show_receipt',
    description: 'Display a printable receipt for a transaction in the chat. Use find_transactions first to get its id.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['transaction_id'],
      properties: {
        transaction_id: { type: 'string', format: 'uuid' },
      },
    },
  },
];

// Strict tool use guarantees the shape; these re-check what JSON Schema can't express here
// (positive amounts, real calendar dates, due dates only on credit).
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => !Number.isNaN(Date.parse(d)), 'not a valid date');
const txType = z.enum(['sale', 'expense', 'receivable', 'payable']);

const recordInput = z.object({
  type: txType,
  amount: z.number().positive().max(1e13),
  description: z.string().min(1).max(500),
  category: z.string(),
  counterparty: z.string().max(255).nullable(),
  date: isoDate,
  due_date: isoDate.nullable(),
}).refine((v) => v.due_date === null || v.type === 'receivable' || v.type === 'payable', {
  message: 'due_date is only allowed for receivable or payable transactions',
});
const idInput = z.object({ transaction_id: z.string().uuid() });
const findInput = z.object({
  search: z.string().max(100).nullable(),
  type: txType.nullable(),
  status: z.enum(['pending', 'settled', 'overdue']).nullable(),
  date_from: isoDate.nullable(),
  date_to: isoDate.nullable(),
});
const summaryInput = z.object({ date_from: isoDate.nullable(), date_to: isoDate.nullable() });

// ── Agent turn ────────────────────────────────────────────────
export interface ChatTurnInput {
  shop: Shop;
  userId: string;
  /** Earlier messages in the session, oldest first, not including `userMessage`. */
  history: ChatMessage[];
  userMessage: string;
}

export interface ChatTurnResult {
  reply: string;
  extractedTransactions: Transaction[];
  receiptTransactionId?: string;
}

export interface AgentDeps {
  client: Pick<Anthropic, 'beta'>;
  store: Pick<typeof db, 'createTransaction' | 'findTransactionById' | 'updateTransaction' | 'listTransactions' | 'getFinancialSummary'>;
  now: () => Date;
}

const defaultDeps: AgentDeps = { client, store: db, now: () => new Date() };

const HISTORY_LIMIT = 20;
const MAX_TOOL_ROUNDS = 8;
const RECENT_TX_IN_CONTEXT = 15;

export class ClaudeUnavailableError extends Error {}

export async function runChatTurn(input: ChatTurnInput, deps: AgentDeps = defaultDeps): Promise<ChatTurnResult> {
  const { shop, userId } = input;
  const today = localDate(deps.now(), config.timezone);

  const [recent, monthToDate, allTime] = await Promise.all([
    deps.store.listTransactions(shop.id, userId, { page: 1, limit: RECENT_TX_IN_CONTEXT }),
    deps.store.getFinancialSummary(shop.id, userId, { dateFrom: `${today.slice(0, 8)}01`, dateTo: today }),
    deps.store.getFinancialSummary(shop.id, userId),
  ]);

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: buildShopContext(shop, today, recent.data, monthToDate, allTime) },
  ];

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...toHistoryParams(input.history),
    { role: 'user', content: input.userMessage },
  ];

  const extracted: Transaction[] = [];
  let receiptTransactionId: string | undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await deps.client.beta.messages.create({
        model: config.anthropic.chatModel,
        max_tokens: 8000,
        system,
        tools: TOOLS,
        messages,
        output_config: { effort: 'low' },
        // On a safety decline, re-run the request on a model chosen by refusal category.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
    } catch (err) {
      // Transactions already saved this turn stay saved; tell the caller so the reply can say so.
      if (extracted.length > 0) {
        return { reply: savedButFailedReply(extracted, shop.currency), extractedTransactions: extracted, receiptTransactionId };
      }
      throw new ClaudeUnavailableError(err instanceof Error ? err.message : 'Claude request failed');
    }

    if (response.stop_reason === 'refusal') {
      return {
        reply: "Sorry, I can't help with that one. I can record sales, expenses and credit, or answer questions about your shop's numbers.",
        extractedTransactions: extracted,
        receiptTransactionId,
      };
    }

    if (response.stop_reason !== 'tool_use') {
      let reply = textOf(response.content);
      if (response.stop_reason === 'max_tokens') reply = `${reply}\n\n(My reply was cut short — ask me to continue.)`.trim();
      return { reply: reply || 'Done.', extractedTransactions: extracted, receiptTransactionId };
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      const outcome = await executeTool(block.name, block.input, { shop, userId, today }, deps);
      if (outcome.transaction && block.name === 'record_transaction') extracted.push(outcome.transaction);
      if (outcome.receiptTransactionId) receiptTransactionId = outcome.receiptTransactionId;
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(outcome.result),
        ...(outcome.isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return {
    reply: extracted.length > 0
      ? savedButFailedReply(extracted, shop.currency)
      : 'Sorry, I got stuck working that out. Could you say it again in a simpler way?',
    extractedTransactions: extracted,
    receiptTransactionId,
  };
}

interface ToolOutcome {
  result: unknown;
  isError?: boolean;
  transaction?: Transaction;
  receiptTransactionId?: string;
}

async function executeTool(
  name: string,
  rawInput: unknown,
  ctx: { shop: Shop; userId: string; today: string },
  deps: AgentDeps,
): Promise<ToolOutcome> {
  const { shop, userId } = ctx;
  const fail = (message: string): ToolOutcome => ({ result: { error: message }, isError: true });

  try {
    switch (name) {
      case 'record_transaction': {
        const parsed = recordInput.safeParse(rawInput);
        if (!parsed.success) return fail(formatZodError(parsed.error));
        const v = parsed.data;
        const tx = await deps.store.createTransaction({
          shopId: shop.id,
          userId,
          type: v.type,
          amount: Math.round(v.amount * 100) / 100,
          currency: shop.currency,
          description: v.description,
          category: normalizeCategory(v.type, v.category),
          counterparty: v.counterparty ?? undefined,
          date: v.date,
          dueDate: v.due_date ?? undefined,
          aiCategorized: true,
        });
        return { result: toToolTransaction(tx), transaction: tx };
      }

      case 'settle_transaction': {
        const parsed = idInput.safeParse(rawInput);
        if (!parsed.success) return fail(formatZodError(parsed.error));
        const existing = await deps.store.findTransactionById(parsed.data.transaction_id, shop.id, userId);
        if (!existing) return fail('No transaction with that id in this shop.');
        if (existing.type !== 'receivable' && existing.type !== 'payable') {
          return fail(`Only receivables and payables can be settled; this one is a ${existing.type}.`);
        }
        if (existing.status === 'settled') return fail('That transaction is already settled.');
        const updated = await deps.store.updateTransaction(existing.id, shop.id, userId, { status: 'settled' });
        return { result: toToolTransaction(updated ?? existing) };
      }

      case 'find_transactions': {
        const parsed = findInput.safeParse(rawInput);
        if (!parsed.success) return fail(formatZodError(parsed.error));
        const v = parsed.data;
        const found = await deps.store.listTransactions(shop.id, userId, {
          search: v.search ?? undefined,
          type: v.type ?? undefined,
          status: v.status ?? undefined,
          dateFrom: v.date_from ?? undefined,
          dateTo: v.date_to ?? undefined,
          page: 1,
          limit: 20,
        });
        return { result: { total: found.total, transactions: found.data.map(toToolTransaction) } };
      }

      case 'get_financial_summary': {
        const parsed = summaryInput.safeParse(rawInput);
        if (!parsed.success) return fail(formatZodError(parsed.error));
        const summary = await deps.store.getFinancialSummary(shop.id, userId, {
          dateFrom: parsed.data.date_from ?? undefined,
          dateTo: parsed.data.date_to ?? undefined,
        });
        return { result: { currency: shop.currency, ...summary } };
      }

      case 'show_receipt': {
        const parsed = idInput.safeParse(rawInput);
        if (!parsed.success) return fail(formatZodError(parsed.error));
        const tx = await deps.store.findTransactionById(parsed.data.transaction_id, shop.id, userId);
        if (!tx) return fail('No transaction with that id in this shop.');
        return { result: { shown: true, transaction: toToolTransaction(tx) }, receiptTransactionId: tx.id };
      }

      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (err) {
    console.error(`Tool ${name} failed:`, err);
    return fail('The bookkeeping database could not complete that action. Tell the owner it was not saved.');
  }
}

// ── Context assembly ──────────────────────────────────────────
export function buildShopContext(
  shop: Shop, today: string, recent: Transaction[], monthToDate: FinancialSummary, allTime: FinancialSummary,
): string {
  const categories = (Object.keys(CATEGORIES) as TransactionType[])
    .map((t) => `  ${t}: ${CATEGORIES[t].join(', ')}`)
    .join('\n');
  const recentLines = recent.length
    ? recent.map((t) => `  - ${JSON.stringify(toToolTransaction(t))}`).join('\n')
    : '  (none yet)';
  return `Shop context
Shop: ${shop.name} (${shop.type}${shop.location ? `, ${shop.location}` : ''})
Currency: ${shop.currency}
Today: ${today} (${weekday(today)})

Categories by transaction type:
${categories}

This month so far (${today.slice(0, 8)}01 to ${today}): sales ${monthToDate.totalSales}, expenses ${monthToDate.totalExpenses}, net ${monthToDate.netProfit}. Outstanding credit (all time): customers owe the shop ${allTime.outstandingReceivables} (${allTime.overdueReceivables} of it overdue), the shop owes ${allTime.outstandingPayables}.

Most recent transactions (newest first):
${recentLines}`;
}

function toHistoryParams(history: ChatMessage[]): Anthropic.Beta.BetaMessageParam[] {
  const params = history
    .slice(-HISTORY_LIMIT)
    .filter((m) => m.content.trim().length > 0)
    .map((m): Anthropic.Beta.BetaMessageParam => ({ role: m.role, content: m.content }));
  // The API requires the conversation to open with a user turn.
  while (params[0]?.role === 'assistant') params.shift();
  return params;
}

function toToolTransaction(t: Transaction) {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    description: t.description ?? null,
    category: t.category ?? null,
    counterparty: t.counterparty ?? null,
    date: t.date,
    due_date: t.dueDate ?? null,
    status: t.status,
  };
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

function savedButFailedReply(saved: Transaction[], currency: string): string {
  const lines = saved.map((t) => `- ${t.type}: ${formatAmount(t.amount, currency)}${t.description ? ` — ${t.description}` : ''}`);
  return `I saved these before something went wrong:\n${lines.join('\n')}\nPlease check them, and send the rest of your message again.`;
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-NG')}`;
  }
}

function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
}

/** YYYY-MM-DD for `date` in the given IANA timezone. */
export function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function weekday(isoDay: string): string {
  return new Date(`${isoDay}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

// ── Categorization (REST transaction create without a category) ──
export async function categorizeTransaction(
  description: string,
  type: TransactionType,
  deps: Pick<AgentDeps, 'client'> = defaultDeps,
): Promise<string> {
  const options = CATEGORIES[type];
  const response = await deps.client.beta.messages.create({
    model: config.anthropic.categorizeModel,
    max_tokens: 64,
    system: `You categorize small-shop bookkeeping entries. Reply with exactly one category from the list and nothing else.
Examples:
- expense "bought 10 cartons of indomie from Dangote depot" → Inventory
- expense "paid NEPA bill" → Utilities
- expense "okada to market" → Transport
- expense "POS charges" → Bank & Mobile Money Fees
- sale "fixed customer phone screen" → Service Income`,
    messages: [{
      role: 'user',
      content: `Type: ${type}\nCategories: ${options.join(', ')}\nEntry: ${JSON.stringify(description)}`,
    }],
  });
  return normalizeCategory(type, textOf(response.content));
}
