import {
  runChatTurn, categorizeTransaction, normalizeCategory, localDate, buildShopContext,
  ClaudeUnavailableError, AgentDeps, TOOLS,
} from './claude';
import { Shop, Transaction, FinancialSummary, ChatMessage } from '../types';

const SHOP: Shop = {
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: 'u1',
  name: 'Mama Tolu Provisions',
  type: 'retail',
  location: 'Yaba, Lagos',
  currency: 'NGN',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const USER = 'u1';
const TX_ID = '22222222-2222-4222-8222-222222222222';

const EMPTY_SUMMARY: FinancialSummary = {
  totalSales: 0, totalExpenses: 0, netProfit: 0,
  outstandingReceivables: 0, outstandingPayables: 0, overdueReceivables: 0, transactionCount: 0,
};

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: TX_ID, shopId: SHOP.id, userId: USER, type: 'sale', amount: 8000, currency: 'NGN',
    description: '20 bags of rice', category: 'Product Sales', date: '2026-10-04',
    status: 'pending', aiCategorized: true, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown };
function msg(stop_reason: string, content: Block[]) {
  return { id: 'msg', type: 'message', role: 'assistant', model: 'm', content, stop_reason, usage: {} };
}

function makeDeps(responses: unknown[]) {
  const create = jest.fn();
  for (const r of responses) {
    if (r instanceof Error) create.mockRejectedValueOnce(r);
    else create.mockResolvedValueOnce(r);
  }
  const store = {
    createTransaction: jest.fn(async (d: Record<string, unknown>) => tx({ ...d, id: TX_ID } as Partial<Transaction>)),
    findTransactionById: jest.fn(async () => null as Transaction | null),
    updateTransaction: jest.fn(async () => null as Transaction | null),
    listTransactions: jest.fn(async () => ({ data: [] as Transaction[], total: 0, page: 1, limit: 15 })),
    getFinancialSummary: jest.fn(async () => EMPTY_SUMMARY),
  };
  const deps = {
    client: { beta: { messages: { create } } },
    store,
    // 23:30 UTC on Oct 3 is 00:30 on Oct 4 in Lagos.
    now: () => new Date('2026-10-03T23:30:00Z'),
  } as unknown as AgentDeps;
  return { deps, create, store };
}

const input = (userMessage: string, history: ChatMessage[] = []) => ({ shop: SHOP, userId: USER, history, userMessage });

describe('runChatTurn', () => {
  it('returns a plain reply without touching the books', async () => {
    const { deps, create, store } = makeDeps([msg('end_turn', [{ type: 'text', text: 'How much did you sell it for?' }])]);
    const result = await runChatTurn(input('I sold rice'), deps);

    expect(result).toEqual({ reply: 'How much did you sell it for?', extractedTransactions: [], receiptTransactionId: undefined });
    expect(store.createTransaction).not.toHaveBeenCalled();
    const req = create.mock.calls[0][0];
    expect(req.messages).toEqual([{ role: 'user', content: 'I sold rice' }]);
    expect(req.system[1].text).toContain('Today: 2026-10-04 (Sunday)');
    expect(req.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('records a transaction from a tool call and returns it', async () => {
    const { deps, create, store } = makeDeps([
      msg('tool_use', [{
        type: 'tool_use', id: 't1', name: 'record_transaction',
        input: { type: 'sale', amount: 8000, description: '20 bags of rice', category: 'Product Sales', counterparty: null, date: '2026-10-04', due_date: null },
      }]),
      msg('end_turn', [{ type: 'text', text: 'Saved: sale ₦8,000 — 20 bags of rice.' }]),
    ]);
    const result = await runChatTurn(input('I sold 20 bags of rice for 8000'), deps);

    expect(store.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      shopId: SHOP.id, userId: USER, type: 'sale', amount: 8000, currency: 'NGN',
      category: 'Product Sales', date: '2026-10-04', aiCategorized: true,
    }));
    expect(result.extractedTransactions).toHaveLength(1);
    expect(result.reply).toBe('Saved: sale ₦8,000 — 20 bags of rice.');

    const second = create.mock.calls[1][0];
    expect(second.messages).toHaveLength(3);
    const toolResult = second.messages[2].content[0];
    expect(toolResult).toMatchObject({ type: 'tool_result', tool_use_id: 't1' });
    expect(toolResult.is_error).toBeUndefined();
  });

  it('rejects invalid tool input with an error result and keeps going', async () => {
    const { deps, create, store } = makeDeps([
      msg('tool_use', [{
        type: 'tool_use', id: 't1', name: 'record_transaction',
        input: { type: 'sale', amount: -5, description: 'x', category: 'Product Sales', counterparty: null, date: '2026-10-04', due_date: '2026-10-10' },
      }]),
      msg('end_turn', [{ type: 'text', text: 'What was the amount?' }]),
    ]);
    const result = await runChatTurn(input('sold something'), deps);

    expect(store.createTransaction).not.toHaveBeenCalled();
    const toolResult = create.mock.calls[1][0].messages[2].content[0];
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toMatch(/amount/);
    expect(toolResult.content).toMatch(/due_date/);
    expect(result.extractedTransactions).toEqual([]);
  });

  it('falls back to the type\'s default category when the model picks one for another type', async () => {
    const { deps, store } = makeDeps([
      msg('tool_use', [{
        type: 'tool_use', id: 't1', name: 'record_transaction',
        input: { type: 'expense', amount: 1500, description: 'okada', category: 'Product Sales', counterparty: null, date: '2026-10-04', due_date: null },
      }]),
      msg('end_turn', [{ type: 'text', text: 'ok' }]),
    ]);
    await runChatTurn(input('paid okada 1500'), deps);
    expect(store.createTransaction).toHaveBeenCalledWith(expect.objectContaining({ category: 'Other Expenses' }));
  });

  it('returns all tool results for parallel calls in one user message', async () => {
    const rec = (id: string, amount: number) => ({
      type: 'tool_use' as const, id, name: 'record_transaction',
      input: { type: 'expense', amount, description: 'x', category: 'Transport', counterparty: null, date: '2026-10-04', due_date: null },
    });
    const { deps, create } = makeDeps([msg('tool_use', [rec('a', 100), rec('b', 200)]), msg('end_turn', [{ type: 'text', text: 'ok' }])]);
    const result = await runChatTurn(input('two expenses'), deps);

    expect(result.extractedTransactions).toHaveLength(2);
    const userTurn = create.mock.calls[1][0].messages[2];
    expect(userTurn.content.map((b: { tool_use_id: string }) => b.tool_use_id)).toEqual(['a', 'b']);
  });

  it('sets receiptTransactionId only for a transaction in this shop', async () => {
    const show = msg('tool_use', [{ type: 'tool_use', id: 't1', name: 'show_receipt', input: { transaction_id: TX_ID } }]);
    const done = msg('end_turn', [{ type: 'text', text: 'Here it is.' }]);

    const missing = makeDeps([show, done]);
    expect((await runChatTurn(input('receipt'), missing.deps)).receiptTransactionId).toBeUndefined();

    const found = makeDeps([show, done]);
    found.store.findTransactionById.mockResolvedValueOnce(tx());
    expect((await runChatTurn(input('receipt'), found.deps)).receiptTransactionId).toBe(TX_ID);
    expect(found.store.findTransactionById).toHaveBeenCalledWith(TX_ID, SHOP.id, USER);
  });

  it('settles only open receivables and payables', async () => {
    const settle = msg('tool_use', [{ type: 'tool_use', id: 't1', name: 'settle_transaction', input: { transaction_id: TX_ID } }]);
    const done = msg('end_turn', [{ type: 'text', text: 'ok' }]);

    const sale = makeDeps([settle, done]);
    sale.store.findTransactionById.mockResolvedValueOnce(tx({ type: 'sale' }));
    await runChatTurn(input('Ade paid'), sale.deps);
    expect(sale.store.updateTransaction).not.toHaveBeenCalled();
    expect(sale.create.mock.calls[1][0].messages[2].content[0].is_error).toBe(true);

    const credit = makeDeps([settle, done]);
    credit.store.findTransactionById.mockResolvedValueOnce(tx({ type: 'receivable' }));
    await runChatTurn(input('Ade paid'), credit.deps);
    expect(credit.store.updateTransaction).toHaveBeenCalledWith(TX_ID, SHOP.id, USER, { status: 'settled' });
  });

  it('turns a database failure into a tool error instead of throwing', async () => {
    const { deps, create, store } = makeDeps([
      msg('tool_use', [{
        type: 'tool_use', id: 't1', name: 'record_transaction',
        input: { type: 'sale', amount: 10, description: 'x', category: 'Product Sales', counterparty: null, date: '2026-10-04', due_date: null },
      }]),
      msg('end_turn', [{ type: 'text', text: 'It was not saved.' }]),
    ]);
    store.createTransaction.mockRejectedValueOnce(new Error('connection refused'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await runChatTurn(input('sold x'), deps);
    expect(result.extractedTransactions).toEqual([]);
    expect(create.mock.calls[1][0].messages[2].content[0].is_error).toBe(true);
  });

  it('handles a refusal', async () => {
    const { deps } = makeDeps([msg('refusal', [])]);
    const result = await runChatTurn(input('...'), deps);
    expect(result.reply).toMatch(/can't help/);
  });

  it('throws ClaudeUnavailableError when the first call fails', async () => {
    const { deps } = makeDeps([new Error('overloaded')]);
    await expect(runChatTurn(input('hi'), deps)).rejects.toBeInstanceOf(ClaudeUnavailableError);
  });

  it('reports already-saved transactions if a later call fails', async () => {
    const { deps } = makeDeps([
      msg('tool_use', [{
        type: 'tool_use', id: 't1', name: 'record_transaction',
        input: { type: 'sale', amount: 8000, description: 'rice', category: 'Product Sales', counterparty: null, date: '2026-10-04', due_date: null },
      }]),
      new Error('overloaded'),
    ]);
    const result = await runChatTurn(input('sold rice 8000'), deps);
    expect(result.extractedTransactions).toHaveLength(1);
    expect(result.reply).toMatch(/I saved these/);
  });

  it('stops after the tool-round limit', async () => {
    const loop = msg('tool_use', [{ type: 'tool_use', id: 't', name: 'get_financial_summary', input: { date_from: null, date_to: null } }]);
    const { deps, create } = makeDeps(Array(10).fill(loop));
    const result = await runChatTurn(input('how am I doing'), deps);
    expect(create).toHaveBeenCalledTimes(8);
    expect(result.reply).toMatch(/stuck/);
  });

  it('sends recent history, dropping leading assistant turns and empty messages', async () => {
    const m = (role: 'user' | 'assistant', content: string): ChatMessage => ({
      id: content, sessionId: 's', role, type: 'text', content, extractedTransactionIds: [], createdAt: new Date(),
    });
    const { deps, create } = makeDeps([msg('end_turn', [{ type: 'text', text: 'ok' }])]);
    await runChatTurn(input('now', [m('assistant', 'welcome'), m('user', 'a'), m('user', ''), m('assistant', 'b')]), deps);
    expect(create.mock.calls[0][0].messages).toEqual([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'now' },
    ]);
  });
});

describe('tool schemas', () => {
  it('are strict and list every property as required', () => {
    for (const tool of TOOLS) {
      const schema = tool.input_schema as unknown as { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
      expect(tool.strict).toBe(true);
      expect(schema.additionalProperties).toBe(false);
      expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
    }
  });
});

describe('categorizeTransaction', () => {
  it('accepts a category from the list, case-insensitively', async () => {
    const { deps } = makeDeps([msg('end_turn', [{ type: 'text', text: ' utilities\n' }])]);
    await expect(categorizeTransaction('paid NEPA', 'expense', deps)).resolves.toBe('Utilities');
  });

  it('falls back when the model answers off-list', async () => {
    const { deps } = makeDeps([msg('end_turn', [{ type: 'text', text: 'Electricity bill' }])]);
    await expect(categorizeTransaction('paid NEPA', 'expense', deps)).resolves.toBe('Other Expenses');
  });
});

describe('helpers', () => {
  it('normalizeCategory maps unknowns to the per-type fallback', () => {
    expect(normalizeCategory('payable', 'loan')).toBe('Loan');
    expect(normalizeCategory('receivable', null)).toBe('Other Receivable');
  });

  it('localDate uses the shop timezone, not UTC', () => {
    expect(localDate(new Date('2026-10-03T23:30:00Z'), 'Africa/Lagos')).toBe('2026-10-04');
    expect(localDate(new Date('2026-10-03T23:30:00Z'), 'UTC')).toBe('2026-10-03');
  });

  it('buildShopContext labels outstanding credit as all-time', () => {
    const ctx = buildShopContext(SHOP, '2026-10-04', [], EMPTY_SUMMARY, { ...EMPTY_SUMMARY, outstandingReceivables: 5000 });
    expect(ctx).toContain('customers owe the shop 5000');
    expect(ctx).toContain('(none yet)');
  });
});
