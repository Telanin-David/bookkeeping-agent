const mockCreate = jest.fn();

// Chat and categorization both go through client.messages; one mock records both, in call order.
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: { create: mockCreate },
})));

jest.mock('./db');
jest.mock('./stock');
jest.mock('./alerts');
jest.mock('./staff');
jest.mock('./transactionChanges');
jest.mock('./profit', () => ({ ...jest.requireActual('./profit'), getMonthlyProfit: jest.fn() }));

// Imported after the mocks above so the mocked modules are what claude.ts actually gets.
import * as db from './db';
import * as stock from './stock';
import * as staff from './staff';
import * as profit from './profit';
import * as changes from './transactionChanges';
import { AppError } from '../middleware/errorHandler';
import { sendChatMessage, categorizeTransaction, usageCost, actionNote, type ChatContext } from './claude';
import type { Product, Transaction } from '../types';

const mockDb = db as jest.Mocked<typeof db>;
const mockStock = stock as jest.Mocked<typeof stock>;
const mockStaff = staff as jest.Mocked<typeof staff>;
const mockProfit = profit as jest.Mocked<typeof profit>;
const mockChanges = changes as jest.Mocked<typeof changes>;

function fakeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-rice', shopId: 'shop-1', name: 'Rice (50kg)', unit: 'bag', quantity: 10, lowStockLevel: 3,
    costPrice: 62000, sellingPrice: 68000, isLow: false, lastCountedOn: null, archived: false,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}

const ctx: ChatContext = {
  shopId: 'shop-1',
  userId: 'user-1',
  shopName: 'My Demo Shop',
  shopType: 'retail',
  currency: 'NGN',
};

const usage = { input_tokens: 3000, output_tokens: 100, cache_creation_input_tokens: 4000, cache_read_input_tokens: 0 };

function textResponse(text: string) {
  return { stop_reason: 'end_turn', content: [{ type: 'text', text }], usage };
}

function toolUseResponse(name: string, input: unknown, id = 'tool-1') {
  return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }], usage };
}

function fakeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1', shopId: ctx.shopId, userId: ctx.userId, type: 'sale', amount: 5000,
    currency: 'NGN', description: '2 bags of rice', category: 'Groceries', counterparty: undefined,
    date: '2026-09-25', status: 'settled', amountPaid: 5000, balance: 0, aiCategorized: false,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  mockCreate.mockReset();
  jest.clearAllMocks();
});

describe('sendChatMessage', () => {
  it('records a transaction via record_transaction and surfaces its id', async () => {
    const created = fakeTransaction();
    mockDb.createTransaction.mockResolvedValue(created);

    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_transaction', {
        type: 'sale', amount: 5000, description: '2 bags of rice',
      }))
      // no category given, so record_transaction auto-categorizes via a separate Haiku call
      .mockResolvedValueOnce(textResponse('Groceries'))
      .mockResolvedValueOnce(textResponse('Recorded — 2 bags of rice for ₦5,000.'));

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'I sold 2 bags of rice for 5000' }]);

    expect(result.reply).toBe('Recorded — 2 bags of rice for ₦5,000.');
    expect(result.extractedTransactionIds).toEqual(['tx-1']);
    expect(mockDb.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      shopId: 'shop-1', userId: 'user-1', type: 'sale', amount: 5000, currency: 'NGN', category: 'Groceries', aiCategorized: true,
    }));
  });

  it('rejects a record_transaction call with a non-positive amount without touching the database', async () => {
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_transaction', {
        type: 'sale', amount: -5, description: 'bad amount',
      }))
      .mockResolvedValueOnce(textResponse('Something went wrong recording that.'));

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'weird input' }]);

    expect(mockDb.createTransaction).not.toHaveBeenCalled();
    expect(result.extractedTransactionIds).toEqual([]);
    // sendChatMessage mutates one shared `messages` array across the whole loop, and
    // mock.calls stores that array by reference — so after the loop finishes, every
    // captured call sees the array's FINAL state, not its state at call time. Find the
    // tool_result message by shape instead of relying on it being "the last" message.
    const finalMessages = mockCreate.mock.calls[1][0].messages;
    const toolResultUserMsg = finalMessages.find(
      (m: { content: unknown }) => Array.isArray(m.content) && m.content[0]?.type === 'tool_result',
    );
    expect(toolResultUserMsg.content[0].is_error).toBe(true);
    expect(toolResultUserMsg.content[0].content).toMatch(/positive/i);
  });

  it('finds a transaction and shows its receipt only after locating it', async () => {
    const match = fakeTransaction({ id: 'tx-2', counterparty: 'Mama Nkechi' });
    mockDb.searchTransactions.mockResolvedValue([match]);
    mockDb.findTransactionById.mockResolvedValue(match);

    mockCreate
      .mockResolvedValueOnce(toolUseResponse('find_transactions', { counterparty: 'Mama Nkechi' }, 'call-1'))
      .mockResolvedValueOnce(toolUseResponse('show_receipt', { transactionId: 'tx-2' }, 'call-2'))
      .mockResolvedValueOnce(textResponse("Here's the receipt for Mama Nkechi."));

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'receipt for Mama Nkechi' }]);

    expect(mockDb.searchTransactions).toHaveBeenCalledWith('shop-1', 'user-1', expect.objectContaining({ counterparty: 'Mama Nkechi' }));
    expect(mockDb.findTransactionById).toHaveBeenCalledWith('tx-2', 'shop-1', 'user-1');
    expect(result.receiptTransactionId).toBe('tx-2');
  });

  it('records a debt payment when the customer pays, instead of recording a new sale', async () => {
    const debt = fakeTransaction({ id: 'debt-1', type: 'receivable', status: 'pending', counterparty: 'Mama Nkechi', amount: 20000, amountPaid: 0, balance: 20000 });
    mockDb.searchTransactions.mockResolvedValue([debt]);
    mockDb.recordDebtPayment.mockResolvedValue({
      ok: true,
      transaction: { ...debt, status: 'settled', amountPaid: 20000, balance: 0 },
      payment: { id: 'pay-1', transactionId: 'debt-1', amount: 20000, paidOn: '2026-09-26', createdAt: new Date() },
    });

    mockCreate
      .mockResolvedValueOnce(toolUseResponse('find_transactions', { counterparty: 'Mama Nkechi', unpaidOnly: true }, 'call-1'))
      .mockResolvedValueOnce(toolUseResponse('record_debt_payment', { transactionId: 'debt-1' }, 'call-2'))
      .mockResolvedValueOnce(textResponse('Done — Mama Nkechi’s ₦20,000 is paid in full.'));

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'Mama Nkechi has paid her 20k' }]);

    expect(mockDb.searchTransactions).toHaveBeenCalledWith('shop-1', 'user-1', expect.objectContaining({ unpaidOnly: true }));
    expect(mockDb.recordDebtPayment).toHaveBeenCalledWith('debt-1', 'shop-1', 'user-1', expect.objectContaining({ amount: undefined }));
    expect(mockDb.createTransaction).not.toHaveBeenCalled(); // no new sale: that would count the income twice
    expect(result.extractedTransactionIds).toEqual(['debt-1']);
  });

  it('records a part-payment with the amount and date the owner gave', async () => {
    mockDb.recordDebtPayment.mockResolvedValue({
      ok: true,
      transaction: fakeTransaction({ id: 'debt-1', type: 'receivable', status: 'pending', amount: 20000, amountPaid: 5000, balance: 15000 }),
      payment: { id: 'pay-1', transactionId: 'debt-1', amount: 5000, paidOn: '2026-09-25', createdAt: new Date() },
    });
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_debt_payment', { transactionId: 'debt-1', amount: 5000, paidOn: '2026-09-25' }))
      .mockResolvedValueOnce(textResponse('Recorded ₦5,000 from Mama Nkechi — she still owes ₦15,000.'));

    await sendChatMessage(ctx, [{ role: 'user', content: 'Mama Nkechi paid 5k yesterday' }]);

    expect(mockDb.recordDebtPayment).toHaveBeenCalledWith('debt-1', 'shop-1', 'user-1', expect.objectContaining({ amount: 5000, paidOn: '2026-09-25' }));
  });

  it('tells the model when a payment is more than is owed, without recording it', async () => {
    mockDb.recordDebtPayment.mockResolvedValue({ ok: false, reason: 'more_than_owed', balance: 15000 });
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_debt_payment', { transactionId: 'debt-1', amount: 50000 }))
      .mockResolvedValueOnce(textResponse('She only owes ₦15,000 — did you mean that?'));

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'Mama Nkechi paid 50k' }]);

    const finalMessages = mockCreate.mock.calls[1][0].messages;
    const toolResultUserMsg = finalMessages.find(
      (m: { content: unknown }) => Array.isArray(m.content) && m.content[0]?.type === 'tool_result',
    );
    expect(toolResultUserMsg.content[0].is_error).toBe(true);
    expect(toolResultUserMsg.content[0].content).toMatch(/remaining balance is 15000/);
    expect(result.extractedTransactionIds).toEqual([]);
  });

  it('asks Haiku 4.5 by default, caching the prompt up to the newest message', async () => {
    mockCreate.mockResolvedValueOnce(textResponse('Hello!'));
    await sendChatMessage(ctx, [{ role: 'user', content: 'hi' }]);
    const params = mockCreate.mock.calls[0][0];
    expect(params).toEqual(expect.objectContaining({ model: 'claude-haiku-4-5', cache_control: { type: 'ephemeral' } }));
    // Haiku 4.5 rejects effort, and the fallback beta is for Opus 5 / Fable.
    expect(params).not.toHaveProperty('output_config');
    expect(params).not.toHaveProperty('fallbacks');
  });

  it('logs one usage line per owner message, summed over its tool calls', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    mockDb.searchTransactions.mockResolvedValue([]);
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('find_transactions', {}))
      .mockResolvedValueOnce({ ...textResponse('Nothing found.'), usage: { input_tokens: 200, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 4000 } });

    await sendChatMessage(ctx, [{ role: 'user', content: 'does Musa owe me?' }]);

    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toBe(
      'chat usage shop=shop-1 model=claude-haiku-4-5 calls=2 input=3200 cache_write=4000 cache_read=4000 output=150 cost_usd=0.00935',
    );
    info.mockRestore();
  });

  it('still logs usage when a later call fails', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    mockDb.searchTransactions.mockResolvedValue([]);
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('find_transactions', {}))
      .mockRejectedValueOnce(new Error('overloaded'));

    await expect(sendChatMessage(ctx, [{ role: 'user', content: 'hi' }])).rejects.toThrow('overloaded');
    expect(info.mock.calls[0][0]).toMatch(/calls=1 /);
    info.mockRestore();
  });

  it('never sets receiptTransactionId for a transaction id that does not belong to this shop', async () => {
    mockDb.findTransactionById.mockResolvedValue(null); // not found for this shop/user

    mockCreate
      .mockResolvedValueOnce(toolUseResponse('show_receipt', { transactionId: 'someone-elses-tx' }))
      .mockResolvedValueOnce(textResponse("I couldn't find that transaction."));

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'receipt for tx someone-elses-tx' }]);

    expect(result.receiptTransactionId).toBeUndefined();
  });

  it('reports an already-saved transaction instead of erroring if Claude fails mid-turn', async () => {
    mockDb.createTransaction.mockResolvedValue(fakeTransaction());
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_transaction', {
        type: 'sale', amount: 5000, description: '2 bags of rice', category: 'Groceries',
      }))
      .mockRejectedValueOnce(new Error('rate limited'));

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'I sold 2 bags of rice for 5000' }]);

    expect(result.extractedTransactionIds).toEqual(['tx-1']);
    expect(result.reply).toMatch(/saved that transaction/i);
  });

  it('rethrows a Claude failure when nothing has been saved yet', async () => {
    mockCreate.mockRejectedValueOnce(new Error('invalid key'));
    await expect(sendChatMessage(ctx, [{ role: 'user', content: 'hi' }])).rejects.toThrow('invalid key');
  });

  it('stops after MAX_TOOL_ITERATIONS rather than looping forever', async () => {
    mockDb.searchTransactions.mockResolvedValue([]);
    mockCreate.mockResolvedValue(toolUseResponse('find_transactions', {}));

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'keep going' }]);

    expect(mockCreate).toHaveBeenCalledTimes(6);
    expect(result.reply).toMatch(/smaller messages/i);
  });

  it('saves one usage row per owner message: tokens, cost, and how many transactions it recorded', async () => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
    mockDb.createTransaction.mockResolvedValue(fakeTransaction());
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_transaction', { type: 'sale', amount: 5000, description: '2 bags of rice', category: 'Groceries' }))
      .mockResolvedValueOnce(textResponse('Recorded.'));

    await sendChatMessage(ctx, [{ role: 'user', content: 'I sold 2 bags of rice for 5000' }]);

    expect(mockDb.createTransaction).toHaveBeenCalledWith(expect.objectContaining({ source: 'chat' }));
    expect(mockDb.recordAiUsage).toHaveBeenCalledTimes(1);
    expect(mockDb.recordAiUsage).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', shopId: 'shop-1', model: 'claude-haiku-4-5', calls: 2,
      input: 6000, cacheWrite: 8000, output: 200, recorded: 1, failed: false,
    }));
    (console.info as jest.Mock).mockRestore();
  });

  it('saves a failed usage row when the assistant could not answer at all', async () => {
    mockCreate.mockRejectedValueOnce(new Error('overloaded'));
    await expect(sendChatMessage(ctx, [{ role: 'user', content: 'hi' }])).rejects.toThrow('overloaded');
    expect(mockDb.recordAiUsage).toHaveBeenCalledWith(expect.objectContaining({ calls: 0, costUsd: 0, recorded: 0, failed: true }));
  });

  it('still replies when the usage row cannot be saved', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    mockDb.recordAiUsage.mockRejectedValueOnce(new Error('db down'));
    mockCreate.mockResolvedValueOnce(textResponse('Hello!'));

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'hi' }]);

    expect(result.reply).toBe('Hello!');
    expect(error).toHaveBeenCalledWith('Could not save AI usage:', 'db down');
    error.mockRestore();
    (console.info as jest.Mock).mockRestore();
  });

  it('returns a plain fallback reply on a refusal instead of surfacing raw stop details', async () => {
    mockCreate.mockResolvedValueOnce({ stop_reason: 'refusal', content: [], usage });

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'something disallowed' }]);

    expect(result.reply).toMatch(/rephrase/i);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

/** The first tool_result sent back to the model. */
function firstToolResult() {
  const messages = mockCreate.mock.calls[1][0].messages;
  return messages.find((m: { content: unknown }) => Array.isArray(m.content) && m.content[0]?.type === 'tool_result').content[0];
}

describe('stock tools', () => {
  const products = [fakeProduct(), fakeProduct({ id: 'prod-beans', name: 'Beans (Oloyin)' }), fakeProduct({ id: 'prod-brown', name: 'Brown beans' })];

  it('records a sale with the products sold, resolving names to the stock list', async () => {
    mockStock.listProducts.mockResolvedValue(products);
    mockStock.createTransactionWithItems.mockResolvedValue(fakeTransaction({ id: 'tx-9' }));
    mockStock.getTransactionItems.mockResolvedValue([]);
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_transaction', {
        type: 'sale', amount: 136000, description: '2 bags of rice', category: 'Groceries',
        items: [{ product: 'rice (50KG)', quantity: 2 }],
      }))
      .mockResolvedValueOnce(textResponse('Recorded — 8 bags of rice left.'));

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'sold 2 bags of rice for 136k' }]);

    expect(result.extractedTransactionIds).toEqual(['tx-9']);
    expect(mockStock.createTransactionWithItems).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sale', amount: 136000 }), [{ productId: 'prod-rice', quantity: 2 }],
    );
    expect(mockDb.createTransaction).not.toHaveBeenCalled();
  });

  it('records nothing when a product is not on the stock list, and tells the model the real names', async () => {
    mockStock.listProducts.mockResolvedValue(products);
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_transaction', {
        type: 'sale', amount: 5000, description: 'sugar', category: 'Groceries', items: [{ product: 'Sugar', quantity: 1 }],
      }))
      .mockResolvedValueOnce(textResponse('Sugar isn’t on your stock list.'));

    await sendChatMessage(ctx, [{ role: 'user', content: 'sold sugar' }]);

    expect(mockStock.createTransactionWithItems).not.toHaveBeenCalled();
    expect(mockDb.createTransaction).not.toHaveBeenCalled();
    const toolResult = firstToolResult();
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain('Rice (50kg)');
  });

  it('asks which product when a name matches several', async () => {
    mockStock.listProducts.mockResolvedValue(products);
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('adjust_stock', { product: 'beans', change: -1, reason: 'Damaged' }))
      .mockResolvedValueOnce(textResponse('Which beans?'));

    await sendChatMessage(ctx, [{ role: 'user', content: 'a bag of beans got wet' }]);

    expect(mockStock.adjustStock).not.toHaveBeenCalled();
    const toolResult = firstToolResult();
    expect(toolResult.content).toContain('matches several products');
  });

  it('records a shelf count and returns what was missing', async () => {
    mockStock.listProducts.mockResolvedValue(products);
    mockStock.recordShelfCount.mockResolvedValue([{ product: fakeProduct({ quantity: 9 }), counted: 9, expected: 11, difference: -2 }]);
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_shelf_count', { counts: [{ product: 'Rice (50kg)', counted: 9 }] }))
      .mockResolvedValueOnce(textResponse('2 bags of rice are missing.'));

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'I counted 9 bags of rice' }]);

    expect(result.reply).toBe('2 bags of rice are missing.');
    expect(mockStock.recordShelfCount).toHaveBeenCalledWith('shop-1', 'user-1', expect.objectContaining({ items: [{ productId: 'prod-rice', counted: 9 }] }));
    const toolResult = JSON.parse(firstToolResult().content);
    expect(toolResult.results[0]).toMatchObject({ product: 'Rice (50kg)', recordsSaid: 11, difference: -2 });
  });
});

describe('categorizeTransaction', () => {
  it('returns the trimmed category text from the model', async () => {
    mockCreate.mockResolvedValueOnce(textResponse('  Groceries  \n'));

    const category = await categorizeTransaction('20 bags of rice', 'sale');

    expect(category).toBe('Groceries');
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-haiku-4-5' }));
  });
});

describe('usageCost', () => {
  it('prices cache writes at 1.25x and reads at 0.1x the input price', () => {
    // Haiku 4.5: $1 in, $5 out per million tokens.
    expect(usageCost('claude-haiku-4-5', { calls: 1, input: 1_000_000, cacheWrite: 0, cacheRead: 0, output: 0 })).toBeCloseTo(1);
    expect(usageCost('claude-haiku-4-5', { calls: 1, input: 0, cacheWrite: 1_000_000, cacheRead: 0, output: 0 })).toBeCloseTo(1.25);
    expect(usageCost('claude-haiku-4-5', { calls: 1, input: 0, cacheWrite: 0, cacheRead: 1_000_000, output: 0 })).toBeCloseTo(0.1);
    expect(usageCost('claude-haiku-4-5', { calls: 1, input: 0, cacheWrite: 0, cacheRead: 0, output: 1_000_000 })).toBeCloseTo(5);
  });

  it('gives no figure for a model it has no price for', () => {
    expect(usageCost('some-other-model', { calls: 1, input: 1, cacheWrite: 0, cacheRead: 0, output: 1 })).toBeNull();
  });
});

describe('running costs and profit', () => {
  const toolResult = () => {
    const msgs = mockCreate.mock.calls[1][0].messages as { role: string; content: unknown }[];
    const block = (msgs.find((m) => m.role === 'user' && Array.isArray(m.content)))!.content as { content: string; is_error?: boolean }[];
    return block[0]!;
  };

  it('passes what the money was for, and ignores it on a sale', async () => {
    mockDb.createTransaction.mockResolvedValue(fakeTransaction({ type: 'expense', costKind: 'running' }));
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_transaction', { type: 'expense', amount: 8000, description: 'Diesel', category: 'Fuel', costKind: 'running' }))
      .mockResolvedValueOnce(textResponse('Recorded.'));
    await sendChatMessage(ctx, [{ role: 'user', content: 'bought diesel 8k' }]);
    expect(mockDb.createTransaction).toHaveBeenCalledWith(expect.objectContaining({ type: 'expense', costKind: 'running', staffId: undefined }));

    mockCreate.mockReset();
    mockDb.createTransaction.mockClear();
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_transaction', { type: 'sale', amount: 8000, description: 'Rice', category: 'Food', costKind: 'stock' }))
      .mockResolvedValueOnce(textResponse('Recorded.'));
    await sendChatMessage(ctx, [{ role: 'user', content: 'sold rice 8k' }]);
    expect(mockDb.createTransaction).toHaveBeenCalledWith(expect.objectContaining({ type: 'sale', costKind: undefined }));
  });

  it("links a salary to the staff member and counts it as a running cost", async () => {
    mockStaff.listStaff.mockResolvedValue([{ id: 'staff-ada', name: 'Ada Obi' } as staff.StaffWithPay]);
    mockDb.createTransaction.mockResolvedValue(fakeTransaction({ type: 'expense', staffId: 'staff-ada', costKind: 'running' }));
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_transaction', { type: 'expense', amount: 40000, description: 'Salary', category: 'Salaries', staff: 'ada' }))
      .mockResolvedValueOnce(textResponse('Recorded.'));
    await sendChatMessage(ctx, [{ role: 'user', content: 'paid Ada her salary 40k' }]);
    expect(mockDb.createTransaction).toHaveBeenCalledWith(expect.objectContaining({ staffId: 'staff-ada', costKind: 'running' }));
    expect(mockStaff.refreshSalaryAlerts).toHaveBeenCalledWith('shop-1');
  });

  it('records nothing for a staff name that is not on the list', async () => {
    mockStaff.listStaff.mockResolvedValue([{ id: 'staff-ada', name: 'Ada Obi' } as staff.StaffWithPay]);
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_transaction', { type: 'expense', amount: 40000, description: 'Salary', category: 'Salaries', staff: 'Musa' }))
      .mockResolvedValueOnce(textResponse('Who is Musa?'));
    await sendChatMessage(ctx, [{ role: 'user', content: 'paid Musa 40k' }]);
    expect(mockDb.createTransaction).not.toHaveBeenCalled();
    expect(toolResult().is_error).toBe(true);
    expect(toolResult().content).toContain('Ada Obi');
  });

  it('answers "how is my business doing" from the real figures', async () => {
    mockProfit.getMonthlyProfit.mockResolvedValue({
      month: '2026-09', from: '2026-09-01', to: '2026-09-25', inProgress: true, method: 'spent',
      sales: 300000, costOfGoodsSold: null, stockBought: 100000, runningCosts: 80000, running: [], profit: 120000,
      previous: { profit: 90000 }, salariesDue: null, methodNote: 'note',
      insights: [{ kind: 'vs_last_month', tone: 'good', text: '₦30,000 better than at this point last month.' }],
    } as unknown as profit.MonthlyProfit);
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('get_business_summary', {}))
      .mockResolvedValueOnce(textResponse('You made ₦120,000 so far.'));
    await sendChatMessage(ctx, [{ role: 'user', content: 'how is my business doing?' }]);
    expect(mockProfit.getMonthlyProfit).toHaveBeenCalledWith('shop-1', 'user-1', expect.stringMatching(/^\d{4}-\d{2}$/), expect.any(String), 'NGN');
    const result = JSON.parse(toolResult().content);
    expect(result).toMatchObject({ profit: 120000, lastMonthSamePoint: 90000, feedback: ['₦30,000 better than at this point last month.'], methodNote: 'note' });
  });
});

describe('memory of what the assistant did', () => {
  it('logs one line per change, with the id, and none for a plain answer', async () => {
    mockDb.createTransaction.mockResolvedValue(fakeTransaction({ amount: 7000, description: '2 crates of Coke' }));
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_transaction', { type: 'sale', amount: 7000, description: '2 crates of Coke', category: 'Drinks' }))
      .mockResolvedValueOnce(textResponse('Saved.'));
    const saved = await sendChatMessage(ctx, [{ role: 'user', content: 'Sold 2 crates of Coke, 7k' }]);
    expect(saved.actions).toEqual(['recorded sale of ₦7,000 "2 crates of Coke" on 2026-09-25 [id tx-1]']);

    mockCreate.mockResolvedValueOnce(textResponse('How much was it?'));
    expect((await sendChatMessage(ctx, [{ role: 'user', content: 'I sold rice' }])).actions).toEqual([]);
  });

  it('logs a part payment with what is still owed, and a receipt shown', async () => {
    const debt = fakeTransaction({ id: 'debt-1', type: 'receivable', status: 'pending', counterparty: 'Bola', amount: 5000, amountPaid: 3000, balance: 2000 });
    mockDb.recordDebtPayment.mockResolvedValue({
      ok: true, transaction: debt, payment: { id: 'pay-1', transactionId: 'debt-1', amount: 3000, paidOn: '2026-09-25', createdAt: new Date() },
    });
    mockDb.findTransactionById.mockResolvedValue(debt);
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('record_debt_payment', { transactionId: 'debt-1', amount: 3000 }))
      .mockResolvedValueOnce(toolUseResponse('show_receipt', { transactionId: 'debt-1' }))
      .mockResolvedValueOnce(textResponse('Done.'));
    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'Bola paid 3000, give me receipt' }]);
    expect(result.actions).toEqual([
      'recorded a payment of ₦3,000 on receivable of ₦5,000 "2 bags of rice" (Bola) on 2026-09-25 [id debt-1]; ₦2,000 still owed',
      'showed the receipt for receivable of ₦5,000 "2 bags of rice" (Bola) on 2026-09-25 [id debt-1]',
    ]);
  });

  it('formats the note the chat route adds to earlier replies', () => {
    expect(actionNote(['deleted sale of ₦7,000'])).toBe('<actions_taken>\n- deleted sale of ₦7,000\n</actions_taken>');
    expect(actionNote([])).toBe('<actions_taken>\nnone\n</actions_taken>');
  });

  it('strips a note the model writes itself', async () => {
    mockCreate.mockResolvedValueOnce(textResponse('Saved.\n\n<actions_taken>\n- made up\n</actions_taken>'));
    expect((await sendChatMessage(ctx, [{ role: 'user', content: 'hi' }])).reply).toBe('Saved.');
  });
});

describe('fixing and removing transactions', () => {
  it('edits only the fields given and logs before and after', async () => {
    const before = fakeTransaction({ amount: 3250, description: '5 tins of milk @ 650' });
    const after = { ...before, amount: 3500, description: '5 tins of milk @ 700' };
    mockDb.findTransactionById.mockResolvedValue(before);
    mockChanges.editTransaction.mockResolvedValue({ before, after });
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('edit_transaction', { transactionId: 'tx-1', amount: 3500, description: '5 tins of milk @ 700' }))
      .mockResolvedValueOnce(textResponse('Fixed.'));

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'The milk was 700 each, not 650' }]);

    expect(mockChanges.editTransaction).toHaveBeenCalledWith('tx-1', 'shop-1', 'user-1', { amount: 3500, description: '5 tins of milk @ 700' });
    expect(mockDb.createTransaction).not.toHaveBeenCalled();
    expect(result.extractedTransactionIds).toEqual(['tx-1']);
    expect(result.actions).toEqual([
      'changed sale of ₦3,250 "5 tins of milk @ 650" on 2026-09-25 [id tx-1] to sale of ₦3,500 "5 tins of milk @ 700" on 2026-09-25 [id tx-1]',
    ]);
  });

  it('refuses an empty edit, a due date on a sale, and passes on why a change is not allowed', async () => {
    mockDb.findTransactionById.mockResolvedValue(fakeTransaction());
    mockChanges.editTransaction.mockRejectedValue(new AppError(400, 'BAD_REQUEST', 'The amount can’t be less than what has already been paid (5,000.00).'));
    for (const input of [{ transactionId: 'tx-1' }, { transactionId: 'tx-1', dueDate: '2026-10-10' }, { transactionId: 'tx-1', amount: 100 }]) {
      mockCreate
        .mockResolvedValueOnce(toolUseResponse('edit_transaction', input))
        .mockResolvedValueOnce(textResponse('ok'));
      const result = await sendChatMessage(ctx, [{ role: 'user', content: 'fix it' }]);
      expect(result.actions).toEqual([]);
    }
    expect(mockChanges.editTransaction).toHaveBeenCalledTimes(1);
    // The loop keeps appending to the same messages array, so look for the tool result rather than the last entry.
    const sent = mockCreate.mock.calls.at(-1)![0].messages as { role: string; content: unknown }[];
    const toolResult = sent.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).find((b) => b.type === 'tool_result');
    expect(toolResult).toMatchObject({ is_error: true, content: expect.stringMatching(/already been paid/) });
  });

  it('deletes through the shared service and does not list the gone transaction', async () => {
    mockChanges.removeTransaction.mockResolvedValue(fakeTransaction({ amount: 7000, description: '2 crates of Coke' }));
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('delete_transaction', { transactionId: 'tx-1' }))
      .mockResolvedValueOnce(textResponse('Removed.'));

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'Remove the Coke sale' }]);

    expect(mockChanges.removeTransaction).toHaveBeenCalledWith('tx-1', 'shop-1', 'user-1');
    expect(result.actions).toEqual(['deleted sale of ₦7,000 "2 crates of Coke" on 2026-09-25 [id tx-1]']);
    expect(result.extractedTransactionIds).toEqual([]);
  });

  it('tells the model when there is nothing to delete', async () => {
    mockChanges.removeTransaction.mockResolvedValue(null);
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('delete_transaction', { transactionId: 'nope' }))
      .mockResolvedValueOnce(textResponse('Not found.'));
    expect((await sendChatMessage(ctx, [{ role: 'user', content: 'delete it' }])).actions).toEqual([]);
  });
});
