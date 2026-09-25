const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: { create: mockCreate },
})));

jest.mock('./db');

// Imported after the mocks above so the mocked modules are what claude.ts actually gets.
import * as db from './db';
import { sendChatMessage, categorizeTransaction, type ChatContext } from './claude';
import type { Transaction } from '../types';

const mockDb = db as jest.Mocked<typeof db>;

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
    date: '2026-09-25', status: 'settled', aiCategorized: false,
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

describe('categorizeTransaction', () => {
  it('returns the trimmed category text from the model', async () => {
    mockCreate.mockResolvedValueOnce(textResponse('  Groceries  \n'));

    const category = await categorizeTransaction('20 bags of rice', 'sale');

    expect(category).toBe('Groceries');
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-haiku-4-5' }));
  });
});
