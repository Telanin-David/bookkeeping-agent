/**
 * Live test of the chat agent against the real Claude API, with an in-memory
 * shop instead of Postgres. Stops before spending more than the cap.
 *
 *   cd apps/backend
 *   echo "ANTHROPIC_API_KEY=sk-ant-..." > .env      # .env is gitignored
 *   npm run test:live                               # default cap $0.50
 *   npm run test:live -- --cap 0.25
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';

// config.ts requires these for the real server; this script never touches a database.
process.env['DATABASE_URL'] ??= 'postgres://unused:unused@localhost:5432/unused';
process.env['JWT_ACCESS_SECRET'] ??= 'unused';
process.env['JWT_REFRESH_SECRET'] ??= 'unused';

// USD per million tokens. Update if you change CLAUDE_CHAT_MODEL.
const PRICES: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'claude-sonnet-5-5': { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  'claude-opus-5-5': { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

const SCENARIOS = [
  { say: 'I sold 20 bags of rice for 8000 naira today', expect: 'records one sale of 8,000' },
  { say: 'Bought 3 cartons of indomie at 4500 each from Dangote depot', expect: 'records one expense of 13,500 (Inventory)' },
  { say: 'Mama Nkechi collect 2 crates of egg on credit, 7000, she go pay next Friday', expect: 'records a receivable with a due date' },
  { say: 'Ade don pay me the money he owe', expect: 'settles Ade\'s existing receivable, no new sale' },
  { say: 'I sold rice', expect: 'asks for the amount, records nothing' },
  { say: 'Paid NEPA 5000 and okada 1500', expect: 'records two expenses' },
  { say: 'How much profit I make this month?', expect: 'answers from the numbers, no invented figures' },
  { say: 'Give me receipt for the rice I sold today', expect: 'shows a receipt for the rice sale' },
];

async function main() {
  const capArg = process.argv.indexOf('--cap');
  const cap = capArg > -1 ? Number(process.argv[capArg + 1]) : 0.5;
  if (!Number.isFinite(cap) || cap <= 0) throw new Error('--cap must be a positive dollar amount');

  const { config } = await import('../src/config');
  if (!config.anthropic.hasCredentials) {
    console.error('No ANTHROPIC_API_KEY found. Put it in apps/backend/.env (see the comment at the top of this file).');
    process.exit(1);
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const { runChatTurn } = await import('../src/services/claude');
  type Tx = import('../src/types').Transaction;
  type Shop = import('../src/types').Shop;
  type ChatMessage = import('../src/types').ChatMessage;

  const price = PRICES[config.anthropic.chatModel];
  if (!price) throw new Error(`No price listed for ${config.anthropic.chatModel}; add it to PRICES so the cap works.`);

  // ── In-memory shop ──
  const userId = 'live-test-user';
  const shop: Shop = {
    id: randomUUID(), ownerId: userId, name: 'Mama Tolu Provisions', type: 'retail', location: 'Yaba, Lagos',
    currency: 'NGN', isActive: true, createdAt: new Date(), updatedAt: new Date(),
  };
  const txs: Tx[] = [];
  const add = (t: Partial<Tx>): Tx => {
    const tx = {
      id: randomUUID(), shopId: shop.id, userId, currency: 'NGN', status: 'pending', aiCategorized: false,
      createdAt: new Date(), updatedAt: new Date(), ...t,
    } as Tx;
    txs.unshift(tx);
    return tx;
  };
  add({ type: 'receivable', amount: 12000, description: '1 bag of beans on credit', category: 'Customer Credit', counterparty: 'Ade', date: '2026-09-28' });
  add({ type: 'expense', amount: 45000, description: 'Shop rent', category: 'Rent', date: '2026-10-01', status: 'settled' });

  const inRange = (t: Tx, from?: string, to?: string) => (!from || t.date >= from) && (!to || t.date <= to);
  const sum = (list: Tx[], pred: (t: Tx) => boolean) => list.filter(pred).reduce((s, t) => s + t.amount, 0);
  const store = {
    async createTransaction(d: Partial<Tx>) { return add({ ...d, aiCategorized: true }); },
    async findTransactionById(id: string) { return txs.find((t) => t.id === id) ?? null; },
    async updateTransaction(id: string, _s: string, _u: string, d: Partial<Tx>) {
      const t = txs.find((x) => x.id === id);
      if (t) Object.assign(t, d);
      return t ?? null;
    },
    async listTransactions(_s: string, _u: string, o: { type?: string; status?: string; search?: string; dateFrom?: string; dateTo?: string; limit: number }) {
      const q = o.search?.toLowerCase();
      const data = txs.filter((t) => (!o.type || t.type === o.type) && (!o.status || t.status === o.status)
        && inRange(t, o.dateFrom, o.dateTo)
        && (!q || t.description?.toLowerCase().includes(q) || t.counterparty?.toLowerCase().includes(q)));
      return { data: data.slice(0, o.limit), total: data.length, page: 1, limit: o.limit };
    },
    async getFinancialSummary(_s: string, _u: string, o: { dateFrom?: string; dateTo?: string } = {}) {
      const r = txs.filter((t) => inRange(t, o.dateFrom, o.dateTo));
      const totalSales = sum(r, (t) => t.type === 'sale');
      const totalExpenses = sum(r, (t) => t.type === 'expense');
      return {
        totalSales, totalExpenses, netProfit: totalSales - totalExpenses,
        outstandingReceivables: sum(r, (t) => t.type === 'receivable' && t.status !== 'settled'),
        outstandingPayables: sum(r, (t) => t.type === 'payable' && t.status !== 'settled'),
        overdueReceivables: 0, transactionCount: r.length,
      };
    },
  };

  // ── Metered client: every call adds to the bill; refuse new calls once over the cap ──
  const real = new Anthropic();
  let spent = 0;
  let calls = 0;
  const create = async (params: Parameters<typeof real.beta.messages.create>[0]) => {
    if (spent >= cap) throw new Error(`cost cap $${cap.toFixed(2)} reached`);
    const res = await real.beta.messages.create({ ...params, stream: false });
    const u = res.usage;
    spent += ((u.input_tokens ?? 0) * price.input + (u.output_tokens ?? 0) * price.output
      + (u.cache_creation_input_tokens ?? 0) * price.cacheWrite + (u.cache_read_input_tokens ?? 0) * price.cacheRead) / 1e6;
    calls++;
    return res;
  };
  const deps = { client: { beta: { messages: { create } } }, store, now: () => new Date() } as never;

  console.log(`Model: ${config.anthropic.chatModel}   Cost cap: $${cap.toFixed(2)}\n`);
  const history: ChatMessage[] = [];
  const msg = (role: 'user' | 'assistant', content: string): ChatMessage =>
    ({ id: randomUUID(), sessionId: 's', role, type: 'text', content, extractedTransactionIds: [], createdAt: new Date() });

  for (const [i, s] of SCENARIOS.entries()) {
    if (spent >= cap) { console.log(`\nStopped: cost cap reached before scenario ${i + 1}.`); break; }
    const before = spent;
    console.log(`── ${i + 1}. Owner: ${s.say}`);
    console.log(`   Expect: ${s.expect}`);
    try {
      const r = await runChatTurn({ shop, userId, history: [...history], userMessage: s.say }, deps);
      console.log(`   Agent:  ${r.reply.replace(/\n/g, '\n           ')}`);
      for (const t of r.extractedTransactions) {
        console.log(`   SAVED:  ${t.type} ${t.amount} | ${t.category} | ${t.description}${t.counterparty ? ` | ${t.counterparty}` : ''}${t.dueDate ? ` | due ${t.dueDate}` : ''}`);
      }
      if (r.receiptTransactionId) console.log(`   RECEIPT for ${txs.find((t) => t.id === r.receiptTransactionId)?.description}`);
      history.push(msg('user', s.say), msg('assistant', r.reply));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`   ERROR:  ${message}`);
      if (/\b401\b|authentication_error/.test(message)) {
        console.log('\nStopped: the API key was rejected. Check the key in apps/backend/.env.');
        break;
      }
    }
    console.log(`   Cost:   $${(spent - before).toFixed(4)}\n`);
  }

  console.log('── Books after the test ──');
  for (const t of txs) console.log(`   ${t.date} ${t.type.padEnd(10)} ${String(t.amount).padStart(7)} ${t.status.padEnd(8)} ${t.description}`);
  console.log(`\nAPI calls: ${calls}   Total cost: $${spent.toFixed(4)} (estimate from token counts)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
