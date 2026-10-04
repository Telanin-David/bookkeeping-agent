import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import * as db from './db';
import * as stock from './stock';
import * as staff from './staff';
import { getMonthlyProfit, isMonth } from './profit';
import { checkDuplicateSafely, refreshDebtAlerts } from './alerts';
import { todayIso, addDays } from '../utils/dates';
import { amount as money } from '../utils/money';
import { editTransaction, removeTransaction, TransactionChanges } from './transactionChanges';
import { AppError } from '../middleware/errorHandler';
import { CostKind, Transaction, TransactionType } from '../types';

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

// Sonnet 5.5 by default for the chat agent: in a live 10-message test Haiku 4.5 said it had
// saved, fixed or removed something without calling the tool 1–3 times a run, which leaves
// the books wrong while the owner thinks they're right; Sonnet 5.5 did all 10 correctly at
// about 3x Haiku's cost. Haiku 4.5 stays for one-shot category classification.
const CHAT_MODEL = config.anthropic.chatModel;
const CATEGORIZE_MODEL = 'claude-haiku-4-5';

// The newer models' safety classifiers can occasionally decline a harmless request (a
// "refusal"). With server-side fallbacks the API re-runs a declined request on the model
// Anthropic recommends for that kind of refusal, in the same call, instead of the owner
// getting "I couldn't help with that". Only these models take the parameter.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const FALLBACK_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1']);

// US$ per million tokens (input, output), for the usage log only. A 5-minute cache write
// costs 1.25x input and a cache read 0.1x.
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-4-5': [1, 5],
  'claude-sonnet-5': [2, 10],
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5': [5, 25],
};

// Guards against a runaway tool-calling loop driving up cost on a stuck conversation.
const MAX_TOOL_ITERATIONS = 6;

const TRANSACTION_TYPES = ['sale', 'expense', 'receivable', 'payable'] as const;

// Static across every request, so it (and the tools array, which renders before it) sits at
// the front of the prompt where the cache can reuse it.
const SYSTEM_PROMPT = `You are the bookkeeping agent inside Bookkeeping AI, a chat-first app that helps small shop owners in Nigeria track their sales, expenses, and money owed to or by them — entirely through conversation, in plain everyday language, not accounting jargon.

## Recording transactions
When the owner describes something that happened — a sale, a purchase, money a customer owes, money owed to a supplier — call record_transaction. If a message describes several distinct transactions ("I sold rice and bought sugar"), call record_transaction once per transaction, not once for the whole message.

Never guess an amount or what was sold. If either is unclear, ask a short clarifying question instead of calling the tool. Resolve relative dates ("today", "yesterday", "last Tuesday") against the current date given below before calling the tool — record_transaction takes an explicit date, not a relative phrase.

After recording, confirm what was recorded in one short, natural sentence — don't recite every field back like a form.

For every expense or payable, set costKind: "stock" when they bought goods to resell, "running" for what it costs to run the business (salaries, rent, electricity, fuel and generator, transport, phone and data, repairs, and the like). This is what lets profit be worked out correctly. If you can't tell whether something bought was for resale, ask. For a salary paid to someone on the shop's staff list, also pass their name as staff; list_staff shows the names.

## Answering questions about the shop's money
Never add up or estimate amounts yourself. For "how much did I make/spend", "what's my biggest expense", or anything needing a real total, call get_spending_summary and report its numbers. For "who owes me", "did I sell to X", or finding a specific past transaction, call find_transactions.

## How the business is doing
For "am I making profit?", "how is my business doing?", "how much did I make this month?", call get_business_summary and explain its profit and feedback in plain words. Say which way it counted profit if the method note is present. Never work out profit yourself.

## When a debt is paid
When the owner says a customer has paid money they owed ("Mama Nkechi has paid", "Musa paid 5k of what he owes"), or that they have paid a supplier they owed, that is NOT a new sale or expense — the income or cost was already counted when the credit sale or bill was recorded, so recording it again would count it twice. Instead, call find_transactions with unpaidOnly set to locate the open debt, then call record_debt_payment with its id.

Pass amount only for a part-payment; leave it out when they paid everything still owed. Pass paidOn only if they said when it was paid ("yesterday"), resolved to a date. The debt's balance field says what is still owed; if they paid more than that, don't record anything — tell them what is actually owed. If you can't tell which debt they mean, ask. If no matching unpaid debt exists, say so and ask whether they want to record it as a new sale instead. After recording, tell them what is still owed, if anything.

## Fixing or removing a transaction
When the owner says something already recorded was wrong ("the milk was 700 each, not 650", "it was Emeka, not Ade", "that was yesterday"), call edit_transaction on that transaction with only what changed. Don't record a second transaction to make up the difference. If the whole thing should not be in the books — recorded by mistake, recorded twice, or goods returned and all the money given back — call delete_transaction. If only part of a sale came back, lower its amount with edit_transaction instead.

Find the transaction with find_transactions first, and make sure it is the one they mean; if more than one could match, ask. A transaction can't be switched between money in and money out: delete it and record it again. After the change, say what it was before and what it is now, or what was removed.

## Stock
The shop may keep a stock list: products with how many are on the shelf. When the owner records a sale or a purchase of goods that are on the stock list, pass them as items on record_transaction with the quantity — that is what keeps the shelf count right. Use product names as check_stock returns them; if you aren't sure which product they mean, call check_stock first. Never invent a product: if something isn't on the stock list, record the transaction without items.

For "how many bags of rice do I have?" or "what's running low?", call check_stock. When they bought stock and said what they paid, that is record_transaction (expense, or payable if on credit) with items. Use adjust_stock only for goods that left the shelf without being sold (damaged, expired, used in the shop, given away) or arrived with nothing to pay. When they report counting their shelf ("I counted 9 bags of rice"), call record_shelf_count, then tell them plainly what was missing or extra.

## Receipts and invoices
When the owner asks for a receipt or invoice ("give me a receipt for Mama Nkechi", "print an invoice for that credit sale"), first call find_transactions to locate the real transaction — never invent an id. Once you have identified the one transaction they mean, call show_receipt with its id, then briefly confirm what you're showing them.

## What you already did
Each of your earlier replies in this chat ends with an <actions_taken> note that the app adds. The app writes it from the tools you actually called; it lists exactly what you changed in the books while writing that reply, or says none. Only a tool call changes the books — writing "Recorded", "Fixed" or "Removed" changes nothing. So whenever the owner asks for something to be recorded, fixed or removed, call the tool in that same reply before you say it is done. Trust the note: everything listed there was done, and the books already show it. Never apologise for an action listed there, undo it, or do it again because the books show it — that is what you would expect to see. Show a receipt again only if the owner asks for it again. If an earlier reply said you did something its note doesn't list, tell the owner plainly and offer to do it now. Never write an <actions_taken> note yourself.

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
        costKind: { type: 'string', enum: ['stock', 'running'], description: 'Expense/payable only. stock = goods bought to resell; running = running the business (salaries, rent, electricity, fuel, transport, phone, repairs…)' },
        staff: { type: 'string', description: 'For a salary: the staff member’s name as on the staff list. Omit otherwise.' },
        items: {
          type: 'array',
          description: 'Products from the stock list that were sold (sale/receivable: taken off the shelf) or bought (expense/payable: put on the shelf), with how many. Only for products on the stock list.',
          items: {
            type: 'object',
            properties: {
              product: { type: 'string', description: 'Product name as on the stock list' },
              quantity: { type: 'number', description: 'How many, in the product’s own unit' },
            },
            required: ['product', 'quantity'],
            additionalProperties: false,
          },
        },
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
        unpaidOnly: { type: 'boolean', description: 'Only debts not yet paid — use when looking for a debt someone has just paid' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'record_debt_payment',
    description: 'Record a payment — in full or in part — towards an unpaid receivable (a customer paying what they owed) or payable (the shop paying a supplier). Use instead of record_transaction when an existing debt is paid. Requires the debt’s real id from find_transactions. The debt is marked paid once its payments cover it.',
    input_schema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string', description: 'The unpaid receivable or payable’s id, from a find_transactions result' },
        amount: { type: 'number', description: 'Amount paid, for a part-payment. Omit when the whole remaining balance was paid.' },
        paidOn: { type: 'string', description: 'YYYY-MM-DD the payment was made, resolved from any relative date. Omit for today.' },
      },
      required: ['transactionId'],
      additionalProperties: false,
    },
  },
  {
    name: 'edit_transaction',
    description: 'Correct a transaction already recorded. Pass only the fields that change. Requires the transaction’s real id from find_transactions. Returns it before and after.',
    input_schema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string', description: 'The transaction’s real id, from a find_transactions result' },
        amount: { type: 'number', description: 'Correct total amount' },
        description: { type: 'string', description: 'Correct description of what was sold or bought' },
        category: { type: 'string', description: 'Correct category' },
        counterparty: { type: 'string', description: 'Correct customer or supplier name' },
        date: { type: 'string', description: 'Correct date, YYYY-MM-DD' },
        dueDate: { type: 'string', description: 'Correct due date, YYYY-MM-DD. Receivable/payable only.' },
        costKind: { type: 'string', enum: ['stock', 'running'], description: 'Expense/payable only: what the money was for' },
      },
      required: ['transactionId'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_transaction',
    description: 'Remove a transaction from the books for good, putting back any stock it moved. Requires the transaction’s real id from find_transactions.',
    input_schema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string', description: 'The transaction’s real id, from a find_transactions result' },
      },
      required: ['transactionId'],
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
    name: 'get_business_summary',
    description: 'How the business is doing in a month: sales, costs split into stock and running costs, profit, comparison with last month, and short feedback. Use for any question about profit or how the business is going.',
    input_schema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'YYYY-MM. Omit for this month.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_staff',
    description: 'The shop’s staff list, if it keeps one: names, monthly pay, pay day and whether this pay date’s salary has been recorded.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'check_stock',
    description: 'Look up the shop’s stock list: each product’s quantity on the shelf, unit, prices, and whether it is running low. Use before answering any stock question and to find exact product names.',
    input_schema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Part of a product name to look for. Omit for all products.' },
        lowOnly: { type: 'boolean', description: 'Only products at or below their warning level' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'adjust_stock',
    description: 'Change a product’s quantity for something that is neither a sale nor a purchase: goods damaged, expired, used or given away (negative), or goods that arrived with nothing to pay (positive).',
    input_schema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product name as on the stock list' },
        change: { type: 'number', description: 'How many came in (positive) or left the shelf (negative)' },
        reason: { type: 'string', description: 'Short reason in the owner’s words, e.g. "Damaged", "Expired"' },
        date: { type: 'string', description: 'YYYY-MM-DD. Omit for today.' },
      },
      required: ['product', 'change'],
      additionalProperties: false,
    },
  },
  {
    name: 'record_shelf_count',
    description: 'Record what the owner actually counted on the shelf for one or more products. The stock is set to what was counted, and the result says how many were missing or extra compared with the records.',
    input_schema: {
      type: 'object',
      properties: {
        counts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product: { type: 'string', description: 'Product name as on the stock list' },
              counted: { type: 'number', description: 'How many are actually on the shelf' },
            },
            required: ['product', 'counted'],
            additionalProperties: false,
          },
        },
      },
      required: ['counts'],
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
  /** One line per change made to the books (and per receipt shown), kept with the reply. */
  actions: string[];
}

interface ToolState {
  createdTransactionIds: string[];
  paidDebtIds: string[];
  editedTransactionIds: string[];
  receiptTransactionId?: string;
  actions: string[];
}

/** "sale of ₦7,000 "2 crates of Coke" (Ada) on 2026-10-04 [id …]": enough to find it again later. */
function describeTx(tx: Transaction, currency: string): string {
  const who = tx.counterparty ? ` (${tx.counterparty})` : '';
  const what = tx.description ? ` "${tx.description}"` : '';
  return `${tx.type} of ${money(tx.amount, currency)}${what}${who} on ${tx.date} [id ${tx.id}]`;
}

const ACTIONS_TAG = 'actions_taken';

/** The note the chat route adds to an earlier reply, so the model knows what that reply actually did. */
export function actionNote(actions: string[]): string {
  const body = actions.length ? actions.map((a) => `- ${a}`).join('\n') : 'none';
  return `<${ACTIONS_TAG}>\n${body}\n</${ACTIONS_TAG}>`;
}

/** Removes a note the model wrote itself, imitating the ones in its history. */
function stripActionNotes(text: string): string {
  return text.replace(new RegExp(`<${ACTIONS_TAG}>[\\s\\S]*?(</${ACTIONS_TAG}>|$)`, 'g'), '').trim();
}

function dynamicContext(ctx: ChatContext): string {
  return `Shop: ${ctx.shopName} (${ctx.shopType})\nCurrency: ${ctx.currency}\nToday's date: ${todayIso()}`;
}

function isTransactionType(value: unknown): value is TransactionType {
  return typeof value === 'string' && (TRANSACTION_TYPES as readonly string[]).includes(value);
}

/**
 * Finds the stock-list product the model named: an exact name first (any case), then a
 * single product whose name contains it. Anything else is an error that lists the real
 * names, so the model can ask the owner or try again.
 */
async function resolveProduct(ctx: ChatContext, name: unknown): Promise<{ id: string; name: string; unit: string }> {
  if (typeof name !== 'string' || !name.trim()) throw new Error('product name is required');
  const products = await stock.listProducts(ctx.shopId, ctx.userId);
  const wanted = name.trim().toLowerCase();
  const exact = products.find((p) => p.name.toLowerCase() === wanted);
  if (exact) return exact;
  const partial = products.filter((p) => p.name.toLowerCase().includes(wanted));
  if (partial.length === 1) return partial[0]!;
  const names = (partial.length > 1 ? partial : products).map((p) => p.name);
  if (names.length === 0) throw new Error('This shop has no products on its stock list yet');
  throw new Error(partial.length > 1
    ? `"${name}" matches several products: ${names.join(', ')}. Ask which one.`
    : `No product called "${name}" is on the stock list. Products: ${names.slice(0, 50).join(', ')}`);
}

async function resolveStaff(ctx: ChatContext, name: string): Promise<{ id: string; name: string }> {
  const list = await staff.listStaff(ctx.shopId, ctx.userId);
  const wanted = name.trim().toLowerCase();
  const exact = list.find((s) => s.name.toLowerCase() === wanted);
  if (exact) return exact;
  const partial = list.filter((s) => s.name.toLowerCase().includes(wanted));
  if (partial.length === 1) return partial[0]!;
  if (list.length === 0) throw new Error('This shop has no staff list. Record the salary without staff.');
  throw new Error(partial.length > 1
    ? `"${name}" matches several staff: ${partial.map((s) => s.name).join(', ')}. Ask which one.`
    : `No one called "${name}" is on the staff list. Staff: ${list.map((s) => s.name).join(', ')}. Record without staff if they aren't on it.`);
}

function isPositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
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

      // Resolve products before saving anything, so a wrong name records nothing.
      const rawItems = Array.isArray(args['items']) ? args['items'] as Record<string, unknown>[] : [];
      const items = [];
      for (const item of rawItems) {
        if (!isPositive(item['quantity'])) throw new Error('each item needs a positive quantity');
        items.push({ productId: (await resolveProduct(ctx, item['product'])).id, quantity: item['quantity'] });
      }

      const isCost = type === 'expense' || type === 'payable';
      const costKind: CostKind | undefined = isCost && (args['costKind'] === 'stock' || args['costKind'] === 'running') ? args['costKind'] : undefined;
      let staffId: string | undefined;
      if (isCost && typeof args['staff'] === 'string' && args['staff'].trim()) {
        staffId = (await resolveStaff(ctx, args['staff'])).id;
      }

      const data = {
        shopId: ctx.shopId,
        userId: ctx.userId,
        type,
        costKind: staffId ? 'running' as const : costKind,
        staffId,
        amount,
        currency: ctx.currency,
        description,
        category,
        counterparty: typeof args['counterparty'] === 'string' ? args['counterparty'] : undefined,
        date: typeof args['date'] === 'string' ? args['date'] : todayIso(),
        dueDate: typeof args['dueDate'] === 'string' ? args['dueDate'] : undefined,
        aiCategorized,
        source: 'chat' as const,
      };
      const tx = items.length ? await stock.createTransactionWithItems(data, items) : await db.createTransaction(data);
      state.createdTransactionIds.push(tx.id);
      state.actions.push(`recorded ${describeTx(tx, ctx.currency)}`);
      await checkDuplicateSafely(tx);
      if (tx.dueDate) await refreshDebtAlerts(tx.id);
      if (tx.staffId) await staff.refreshSalaryAlerts(tx.shopId);
      return items.length ? { ...tx, items: await stock.getTransactionItems(tx.id) } : tx;
    }

    case 'find_transactions': {
      const results = await db.searchTransactions(ctx.shopId, ctx.userId, {
        counterparty: typeof args['counterparty'] === 'string' ? args['counterparty'] : undefined,
        description: typeof args['description'] === 'string' ? args['description'] : undefined,
        type: isTransactionType(args['type']) ? args['type'] : undefined,
        unpaidOnly: args['unpaidOnly'] === true,
      });
      return { count: results.length, transactions: results };
    }

    case 'record_debt_payment': {
      const transactionId = args['transactionId'];
      if (typeof transactionId !== 'string') throw new Error('transactionId is required');
      const amount = args['amount'];
      if (amount !== undefined && (typeof amount !== 'number' || !(amount > 0))) throw new Error('amount must be a positive number');
      const paidOn = typeof args['paidOn'] === 'string' ? args['paidOn'] : todayIso();
      const result = await db.recordDebtPayment(transactionId, ctx.shopId, ctx.userId, {
        amount: amount as number | undefined, paidOn, today: todayIso(),
      });
      if (!result.ok) {
        switch (result.reason) {
          case 'not_found': throw new Error('No transaction with that id exists for this shop');
          case 'not_a_debt': throw new Error('Only receivables and payables (debts) can be paid off — this is a cash sale or expense');
          case 'already_paid': throw new Error('That debt is already fully paid');
          case 'more_than_owed': throw new Error(`That is more than is still owed; the remaining balance is ${result.balance}`);
          case 'before_debt': throw new Error('The payment date is before the debt was recorded');
          case 'in_future': throw new Error('The payment date is in the future');
        }
      }
      state.paidDebtIds.push(result.transaction.id);
      const left = result.transaction.balance;
      state.actions.push(`recorded a payment of ${money(result.payment.amount, ctx.currency)} on ${describeTx(result.transaction, ctx.currency)}; `
        + (left > 0 ? `${money(left, ctx.currency)} still owed` : 'now fully paid'));
      await refreshDebtAlerts(result.transaction.id);
      return { recorded: true, payment: result.payment, transaction: result.transaction };
    }

    case 'edit_transaction': {
      const transactionId = args['transactionId'];
      if (typeof transactionId !== 'string') throw new Error('transactionId is required');
      const changes: TransactionChanges = {};
      if (args['amount'] !== undefined) {
        if (!isPositive(args['amount'])) throw new Error('amount must be a positive number');
        changes.amount = args['amount'];
      }
      for (const key of ['description', 'category', 'counterparty', 'date', 'dueDate'] as const) {
        const value = args[key];
        if (value === undefined) continue;
        if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} must be a non-empty string`);
        changes[key] = value.trim();
      }
      if (args['costKind'] !== undefined) {
        if (args['costKind'] !== 'stock' && args['costKind'] !== 'running') throw new Error('costKind must be stock or running');
        changes.costKind = args['costKind'];
      }
      if (Object.keys(changes).length === 0) throw new Error('Nothing to change: pass at least one field');
      const existing = await db.findTransactionById(transactionId, ctx.shopId, ctx.userId);
      if (!existing) throw new Error('No transaction with that id exists for this shop');
      const isCredit = existing.type === 'receivable' || existing.type === 'payable';
      if (changes.dueDate && !isCredit) throw new Error('Only receivables and payables have a due date');
      if (changes.costKind && existing.type !== 'expense' && existing.type !== 'payable') throw new Error('Only expenses and payables have a costKind');
      let result;
      try {
        result = await editTransaction(transactionId, ctx.shopId, ctx.userId, changes);
      } catch (err) {
        // These messages are written for the owner; pass them on as they are.
        if (err instanceof AppError) throw new Error(err.message);
        throw err;
      }
      state.editedTransactionIds.push(result.after.id);
      state.actions.push(`changed ${describeTx(result.before, ctx.currency)} to ${describeTx(result.after, ctx.currency)}`);
      return { updated: true, before: result.before, after: result.after };
    }

    case 'delete_transaction': {
      const transactionId = args['transactionId'];
      if (typeof transactionId !== 'string') throw new Error('transactionId is required');
      const deleted = await removeTransaction(transactionId, ctx.shopId, ctx.userId);
      if (!deleted) throw new Error('No transaction with that id exists for this shop');
      state.actions.push(`deleted ${describeTx(deleted, ctx.currency)}`);
      return { deleted: true, transaction: deleted };
    }

    case 'get_spending_summary': {
      const to = typeof args['to'] === 'string' ? args['to'] : todayIso();
      const from = typeof args['from'] === 'string'
        ? args['from']
        : addDays(to, -30);
      return db.getSpendingSummary(ctx.shopId, ctx.userId, from, to);
    }

    case 'get_business_summary': {
      const today = todayIso();
      const month = typeof args['month'] === 'string' && isMonth(args['month']) ? args['month'] : today.slice(0, 7);
      if (month > today.slice(0, 7)) throw new Error('That month hasn’t started yet');
      const p = await getMonthlyProfit(ctx.shopId, ctx.userId, month, today, ctx.currency);
      return {
        month: p.month, from: p.from, to: p.to, monthInProgress: p.inProgress,
        method: p.method === 'sold' ? 'profit on what was sold (sales − cost of goods sold − running costs)' : 'sales minus all spending',
        sales: p.sales, costOfGoodsSold: p.method === 'sold' ? p.costOfGoodsSold : undefined,
        stockBought: p.stockBought, runningCosts: p.runningCosts, runningCostsByCategory: p.running,
        profit: p.profit, lastMonthSamePoint: p.previous?.profit,
        salariesStillToPay: p.salariesDue?.total,
        feedback: p.insights.map((i) => i.text),
        methodNote: p.methodNote ?? undefined,
      };
    }

    case 'list_staff': {
      const list = await staff.listStaff(ctx.shopId, ctx.userId);
      return {
        count: list.length,
        staff: list.map((s) => ({ name: s.name, role: s.role, monthlyPay: s.monthlyPay, payDay: s.payDay, payDate: s.payDate, paidForPayDate: s.paid })),
      };
    }

    case 'check_stock': {
      const products = await stock.listProducts(ctx.shopId, ctx.userId, {
        search: typeof args['product'] === 'string' ? args['product'] : undefined,
        lowOnly: args['lowOnly'] === true,
      });
      return {
        count: products.length,
        products: products.map((p) => ({
          name: p.name, unit: p.unit, onShelf: p.quantity, warnAt: p.lowStockLevel, runningLow: p.isLow,
          sellingPrice: p.sellingPrice, costPrice: p.costPrice, lastCounted: p.lastCountedOn,
        })),
      };
    }

    case 'adjust_stock': {
      const product = await resolveProduct(ctx, args['product']);
      const change = args['change'];
      if (typeof change !== 'number' || !Number.isFinite(change) || change === 0) throw new Error('change must be a non-zero number');
      const today = todayIso();
      const result = await stock.adjustStock(ctx.shopId, ctx.userId, product.id, {
        kind: 'adjustment', change, today,
        occurredOn: typeof args['date'] === 'string' ? args['date'] : today,
        note: typeof args['reason'] === 'string' ? args['reason'] : undefined,
      });
      return { recorded: true, product: result.product.name, onShelfNow: result.product.quantity, runningLow: result.product.isLow };
    }

    case 'record_shelf_count': {
      const counts = Array.isArray(args['counts']) ? args['counts'] as Record<string, unknown>[] : [];
      if (counts.length === 0) throw new Error('counts must list at least one product');
      const items = [];
      for (const c of counts) {
        const counted = c['counted'];
        if (typeof counted !== 'number' || !Number.isFinite(counted) || counted < 0) throw new Error('counted must be 0 or more');
        items.push({ productId: (await resolveProduct(ctx, c['product'])).id, counted });
      }
      const today = todayIso();
      const lines = await stock.recordShelfCount(ctx.shopId, ctx.userId, { items, occurredOn: today, today });
      return {
        recorded: true,
        results: lines.map((l) => ({
          product: l.product.name, unit: l.product.unit, counted: l.counted, recordsSaid: l.expected,
          // negative: missing; positive: more than recorded
          difference: l.difference,
        })),
      };
    }

    case 'show_receipt': {
      const transactionId = args['transactionId'];
      if (typeof transactionId !== 'string') throw new Error('transactionId is required');
      const tx = await db.findTransactionById(transactionId, ctx.shopId, ctx.userId);
      if (!tx) throw new Error('No transaction with that id exists for this shop');
      state.receiptTransactionId = tx.id;
      state.actions.push(`showed the receipt for ${describeTx(tx, ctx.currency)}`);
      return { shown: true, transaction: tx };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

type Usage = { calls: number; input: number; cacheWrite: number; cacheRead: number; output: number };

function addUsage(total: Usage, u: Anthropic.Usage): void {
  total.calls += 1;
  total.input += u.input_tokens;
  total.cacheWrite += u.cache_creation_input_tokens ?? 0;
  total.cacheRead += u.cache_read_input_tokens ?? 0;
  total.output += u.output_tokens;
}

/** Estimated US$ cost of one owner message, or null for a model without a price above. */
export function usageCost(model: string, u: Usage): number | null {
  const price = PRICES[model];
  if (!price) return null;
  const [inPrice, outPrice] = price;
  return (u.input * inPrice + u.cacheWrite * inPrice * 1.25 + u.cacheRead * inPrice * 0.1 + u.output * outPrice) / 1e6;
}

/**
 * One log line and one ai_usage row per owner message, for the business dashboard. A
 * message the assistant couldn't answer is saved too (failed), even if it cost nothing.
 */
async function saveUsage(ctx: ChatContext, u: Usage, recorded: number, failed: boolean): Promise<void> {
  const cost = usageCost(CHAT_MODEL, u);
  if (u.calls > 0) {
    console.info(`chat usage shop=${ctx.shopId} model=${CHAT_MODEL} calls=${u.calls} input=${u.input} ` +
      `cache_write=${u.cacheWrite} cache_read=${u.cacheRead} output=${u.output}` +
      (cost === null ? '' : ` cost_usd=${cost.toFixed(5)}`));
  }
  try {
    await db.recordAiUsage({ userId: ctx.userId, shopId: ctx.shopId, model: CHAT_MODEL, ...u, costUsd: cost, recorded, failed });
  } catch (err) {
    // The owner's reply matters more than the dashboard's numbers.
    console.error('Could not save AI usage:', err instanceof Error ? err.message : err);
  }
}

export async function sendChatMessage(ctx: ChatContext, history: Anthropic.MessageParam[]): Promise<ClaudeChatResult> {
  const usage: Usage = { calls: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
  const state: ToolState = { createdTransactionIds: [], paidDebtIds: [], editedTransactionIds: [], actions: [] };
  let failed = true;
  try {
    const result = await chatLoop(ctx, history, usage, state);
    failed = false;
    return result;
  } finally {
    await saveUsage(ctx, usage, state.createdTransactionIds.length, failed);
  }
}

/**
 * A response's content as it should be acted on and echoed back. When a fallback model
 * took over mid-answer, `fallback` blocks mark the switch: before the last one, only text
 * is kept (the declined model's tool calls and thinking are dropped, per the fallback
 * rules); everything after it is the fallback model's own answer and is kept as-is.
 */
export function afterFallback(content: Anthropic.Beta.BetaContentBlock[]): Anthropic.Beta.BetaContentBlock[] {
  let boundary = -1;
  content.forEach((b, i) => { if (b.type === 'fallback') boundary = i; });
  if (boundary === -1) return content;
  return content.filter((b, i) => i > boundary || (i < boundary && b.type === 'text'));
}

async function chatLoop(ctx: ChatContext, history: Anthropic.MessageParam[], usage: Usage, state: ToolState): Promise<ClaudeChatResult> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [...history];
  // Every transaction this turn created, marked paid or corrected; the chat shows each one.
  const touched = () => [...new Set([...state.createdTransactionIds, ...state.paidDebtIds, ...state.editedTransactionIds])]
    .filter((id) => !state.actions.some((a) => a.startsWith('deleted ') && a.includes(`[id ${id}]`)));

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create({
        model: CHAT_MODEL,
        ...(FALLBACK_MODELS.has(CHAT_MODEL) ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const } : {}),
        max_tokens: 4096,
        // Caches everything up to the newest message. A turn that uses a tool calls the
        // model again with the same start plus the tool's result, and that second call
        // reads the start from the cache at a tenth of the price. (A marker on the system
        // prompt alone does nothing on Haiku 4.5: it only caches 4,096+ tokens, and the
        // prompt and tools come to about 2,500.)
        cache_control: { type: 'ephemeral' },
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: dynamicContext(ctx) },
        ],
        tools: TOOLS,
        messages,
      });
    } catch (err) {
      // If a transaction was already saved this turn, surfacing an error would make the
      // owner resend and record it twice — report what was saved instead.
      const changes = state.actions.filter((a) => !a.startsWith('showed '));
      if (changes.length === 0) throw err;
      const n = changes.length;
      const onlyRecorded = changes.every((a) => a.startsWith('recorded ') && !a.startsWith('recorded a payment'));
      const what = onlyRecorded
        ? (n === 1 ? 'that transaction' : `${n} transactions`)
        : (n === 1 ? 'that change' : `${n} changes`);
      return {
        reply: `I saved ${what}, but couldn't finish my reply. Check your transactions list before sending it again.`,
        extractedTransactionIds: touched(),
        receiptTransactionId: state.receiptTransactionId,
        actions: state.actions,
      };
    }

    addUsage(usage, response.usage);

    if (response.stop_reason === 'refusal') {
      return {
        reply: "I couldn't help with that one — could you rephrase it?",
        extractedTransactionIds: touched(),
        receiptTransactionId: state.receiptTransactionId,
        actions: state.actions,
      };
    }

    const content = afterFallback(response.content);
    messages.push({ role: 'assistant', content });

    if (response.stop_reason !== 'tool_use') {
      const reply = stripActionNotes(content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join(''));
      return {
        reply: reply || "I'm not sure how to respond to that — could you say it differently?",
        extractedTransactionIds: touched(),
        receiptTransactionId: state.receiptTransactionId,
        actions: state.actions,
      };
    }

    const toolUseBlocks = content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
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
    extractedTransactionIds: touched(),
    receiptTransactionId: state.receiptTransactionId,
    actions: state.actions,
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
