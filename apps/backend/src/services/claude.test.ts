const mockCreate = jest.fn();

// Chat goes through client.beta.messages (for server-side fallbacks); categorization uses
// client.messages. One mock records both, in call order.
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: { create: mockCreate },
  beta: { messages: { create: mockCreate } },
})));

jest.mock('./db');
jest.mock('./stock');

// Imported after the mocks above so the mocked modules are what claude.ts actually gets.
import * as db from './db';
import * as stock from './stock';
import { sendChatMessage, categorizeTransaction, type ChatContext } from './claude';
import type { Product, Transaction } from '../types';

const mockDb = db as jest.Mocked<typeof db>;
const mockStock = stock as jest.Mocked<typeof stock>;

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

function textResponse(text: string) {
  return { stop_reason: 'end_turn', content: [{ type: 'text', text }] };
}

function toolUseResponse(name: string, input: unknown, id = 'tool-1') {
  return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] };
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

  it('asks for server-side refusal fallbacks on every chat request', async () => {
    mockCreate.mockResolvedValueOnce(textResponse('Hello!'));
    await sendChatMessage(ctx, [{ role: 'user', content: 'hi' }]);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-opus-5', fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'],
    }));
  });

  it('after a mid-answer fallback, runs only the fallback model’s tool calls', async () => {
    mockDb.searchTransactions.mockResolvedValue([]);
    mockCreate
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Let me look that up.' },
          { type: 'tool_use', id: 'declined', name: 'record_transaction', input: { type: 'sale', amount: 1, description: 'x' } },
          { type: 'fallback', from: { model: 'claude-opus-5' }, to: { model: 'claude-opus-4-8' } },
          { type: 'tool_use', id: 'kept', name: 'find_transactions', input: { counterparty: 'Musa' } },
        ],
      })
      .mockResolvedValueOnce(textResponse('Musa has no unpaid debts.'));

    const result = await sendChatMessage(ctx, [{ role: 'user', content: 'does Musa owe me?' }]);

    expect(mockDb.createTransaction).not.toHaveBeenCalled(); // the declined model's call never runs
    expect(mockDb.searchTransactions).toHaveBeenCalledTimes(1);
    const echoed = mockCreate.mock.calls[1][0].messages.find((m: { role: string }) => m.role === 'assistant');
    expect(echoed.content.map((b: { type: string; id?: string }) => b.id ?? b.type)).toEqual(['text', 'kept']);
    expect(result.reply).toBe('Musa has no unpaid debts.');
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

  it('returns a plain fallback reply on a refusal instead of surfacing raw stop details', async () => {
    mockCreate.mockResolvedValueOnce({ stop_reason: 'refusal', content: [] });

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
