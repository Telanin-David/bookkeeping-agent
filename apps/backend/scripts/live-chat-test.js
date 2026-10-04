/**
 * Live test of the chat assistant through the real backend: signs up a throwaway owner,
 * records two debts and the rent, then sends 10 messages in one chat, as the app does, and
 * prints each reply, what the assistant changed, and the books at the end. One chat on
 * purpose: later messages only go right if the assistant remembers what it did earlier.
 *
 * Uses real Claude credit (about $0.03 on Haiku 4.5, $0.09 on Sonnet 5.5) and stops once
 * the app's own cost estimate for this run reaches the cap. Run it against a test
 * database, never the live one:
 *
 *   npm run migrate                    # with DATABASE_URL pointing at a test database
 *   npm run dev                        # in another terminal, with ANTHROPIC_API_KEY set
 *   DATABASE_URL=... node scripts/live-chat-test.js [--cap 0.5]
 */
const { Client } = require('pg');
const BASE = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const capArg = process.argv.indexOf('--cap');
const CAP = capArg > -1 ? Number(process.argv[capArg + 1]) : 0.5;
const SAY = [
  ['Ade don pay me the money he owe', "pays off Ade's 12,000 credit, no new sale"],
  ['You don mark Ade own as paid?', 'says yes, without apologising or redoing it'],
  ['Sold 5 tins of milk at 650 each', 'one sale of 3,250'],
  ['Sorry, the milk was 700 each, not 650', 'edits the milk sale to 3,500; no second sale'],
  ['Bola pay 3000 out of the 5000 she owe', 'part payment: Bola still owes 2,000'],
  ['Customer buy 2 crates of Coke, 7k', 'one sale of 7,000'],
  ['Give me receipt for the Coke', 'shows the Coke receipt'],
  ['How much Bola still owe me?', '2,000; no receipt again, no apology'],
  ['Remove the Coke sale, customer return am', 'deletes the Coke sale'],
  ['How much I sell today?', '3,500 (milk only); no apologies, no receipts'],
];
async function api(path, token, body, method) {
  const res = await fetch(BASE + path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}
(async () => {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const spent = async () => Number((await pg.query('SELECT COALESCE(SUM(cost_usd),0) AS c FROM ai_usage')).rows[0].c);
  const start = await spent();
  const { accessToken: t } = await api('/auth/signup', null, { name: 'Mama Tolu', email: `t${Date.now()}@example.com`, password: 'Testing-Pass-123' });
  const shop = await api('/shops', t, { name: 'Mama Tolu Provisions', type: 'retail', location: 'Lagos' });
  const tx = (b) => api(`/shops/${shop.id}/transactions`, t, { currency: 'NGN', ...b });
  await tx({ type: 'receivable', amount: 12000, description: '1 bag of beans on credit', counterparty: 'Ade', date: '2026-09-28' });
  await tx({ type: 'receivable', amount: 5000, description: 'Provisions on credit', counterparty: 'Bola', date: '2026-09-20', dueDate: '2026-09-30' });
  await tx({ type: 'expense', amount: 45000, description: 'Shop rent', category: 'Rent', date: '2026-10-01', costKind: 'running' });
  const session = await api('/chat/sessions', t, { shopId: shop.id });
  for (const [i, [say, expect]] of SAY.entries()) {
    const before = await spent();
    if (before - start >= CAP) { console.log(`Stopped: cost cap reached before ${i + 1}.`); break; }
    console.log(`── ${i + 1}. Owner: ${say}\n   Expect: ${expect}`);
    try {
      const r = await api(`/chat/sessions/${session.id}/messages`, t, { content: say });
      const a = r.assistantMessage;
      console.log(`   Agent:  ${a.content.replace(/\n/g, '\n           ')}`);
      for (const line of a.actions ?? []) console.log(`   DID:    ${line.replace(/ \[id [^\]]+\]/g, '')}`);
      if (a.receiptTransactionId) console.log('   RECEIPT shown');
    } catch (e) { console.log(`   ERROR:  ${e.message}`); }
    console.log(`   Cost:   $${((await spent()) - before).toFixed(4)}\n`);
  }
  const list = await api(`/shops/${shop.id}/transactions?limit=50`, t);
  console.log('── Books after the test ──');
  for (const x of list.data) console.log(`   ${x.date} ${x.type.padEnd(10)} ${String(x.amount).padStart(7)} paid ${String(x.amountPaid).padStart(6)} ${x.status.padEnd(8)} ${x.description}${x.counterparty ? ' - ' + x.counterparty : ''}`);
  const stored = await pg.query(`SELECT role, actions FROM chat_messages WHERE session_id = $1 AND role = 'assistant' ORDER BY created_at`, [session.id]);
  console.log(`\nAssistant messages saved with an action list: ${stored.rows.filter((r) => r.actions !== null).length}/${stored.rows.length}`);
  console.log(`Total cost this run: $${((await spent()) - start).toFixed(4)} (app's own estimate)`);
  await pg.end();
})().catch((e) => { console.error(e); process.exit(1); });
