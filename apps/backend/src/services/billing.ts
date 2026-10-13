// Plans and payment: what an owner can use right now, paying through Paystack, payments an
// admin records by hand, and plan-ending reminders. The rules themselves are in plans.ts.
//
// With BILLING_ENABLED off (the default), nothing here limits anyone: every feature is on and
// the assistant allows CHAT_DAILY_LIMIT messages a day, exactly as before plans existed.
//
// How a Paystack payment unlocks a plan:
//   1. checkout: a 'pending' payment row is saved with a fresh reference and the owner is sent
//      to Paystack's page for exactly that plan's price.
//   2. The owner pays (transfer, card or USSD). Paystack sends them back to /billing and also
//      calls the webhook.
//   3. Either way, confirmPaystackPayment asks Paystack's server what happened. Only a
//      'success' for the right amount in naira unlocks anything; the payment row and the
//      user's row are locked while the plan period is added, and subscriptions.payment_id is
//      unique, so the browser and the webhook arriving together still grant it once.

import crypto from 'crypto';
import { config, db } from '../config';
import { AppError } from '../middleware/errorHandler';
import * as dbs from './db';
import * as P from './plans';
import * as paystack from './paystack';
import { todayIso } from '../utils/dates';
import type { Queryable } from './db';

// ── Settings the admin can change without a deploy ───────────

export async function passesEnabled(client: Queryable = db): Promise<boolean> {
  const { rows } = await client.query(`SELECT value FROM app_settings WHERE key = 'passes_enabled'`);
  return rows[0]?.['value'] === true;
}

export async function setPassesEnabled(enabled: boolean, adminId: string): Promise<void> {
  await db.query(
    `INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES ('passes_enabled', $1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [JSON.stringify(enabled), adminId],
  );
}

// ── What an owner has ────────────────────────────────────────

export interface ChatAllowance {
  used: number;
  /** null: no limit. 0 on the free plan. */
  limit: number | null;
  remaining: number | null;
  /** 'day': resets at midnight. 'period': for the whole trial or day pass. 'none': not included. */
  scope: 'day' | 'period' | 'none';
  /** When more messages become available: midnight, or the end of a day pass. */
  resetsAt: string | null;
}

export interface Entitlements {
  billingEnabled: boolean;
  plan: P.PlanId;
  planName: string;
  /** When the current kind of plan runs out, counting time already paid in advance. */
  endsAt: string | null;
  /** Paid time that starts later. */
  upcoming: { plan: P.PaidPlanId; planName: string; startsAt: string; endsAt: string }[];
  /** Only while on the trial. */
  trial: { endsAt: string; messagesLeft: number } | null;
  features: P.Features;
  chat: ChatAllowance;
  passesEnabled: boolean;
}

function mapPeriod(r: Record<string, unknown>): P.Period {
  return { id: r['id'] as string, plan: r['plan'] as P.Period['plan'], startsAt: r['starts_at'] as Date, endsAt: r['ends_at'] as Date };
}

async function loadPeriods(userId: string, client: Queryable = db): Promise<P.Period[]> {
  const { rows } = await client.query(
    'SELECT id, plan, starts_at, ends_at FROM subscriptions WHERE user_id = $1 ORDER BY starts_at', [userId],
  );
  return rows.map(mapPeriod);
}

/** The trial starts the first time an owner is seen with billing on: one per account, ever. */
async function ensureTrial(userId: string, periods: P.Period[], now: Date): Promise<P.Period[]> {
  if (periods.some((p) => p.plan === 'trial')) return periods;
  await db.query(
    `INSERT INTO subscriptions (user_id, plan, starts_at, ends_at) VALUES ($1, 'trial', $2, $3)
     ON CONFLICT (user_id) WHERE plan = 'trial' DO NOTHING`,
    [userId, now, new Date(now.getTime() + P.trialRule().hours * 3_600_000)],
  );
  return loadPeriods(userId);
}

/** Assistant messages answered since `since`, and — for a daily allowance — only today's. */
async function countMessages(userId: string, since: Date, today: string | null): Promise<{ used: number; midnight: string }> {
  const tz = config.businessTimeZone;
  const { rows } = await db.query(
    `SELECT COUNT(*) FILTER (WHERE created_at >= $2 AND ($3::date IS NULL OR (created_at AT TIME ZONE $4)::date = $3::date)) AS used,
            ((COALESCE($3::date, (NOW() AT TIME ZONE $4)::date) + 1)::timestamp AT TIME ZONE $4) AS midnight
       FROM ai_usage WHERE user_id = $1 AND NOT failed AND created_at >= $2`,
    [userId, since, today, tz],
  );
  return { used: Number(rows[0]!['used']), midnight: (rows[0]!['midnight'] as Date).toISOString() };
}

async function legacyEntitlements(userId: string, admin: boolean): Promise<Entitlements> {
  const used = await dbs.countChatMessagesOn(userId, todayIso(), config.businessTimeZone);
  const limit = config.anthropic.chatDailyLimit;
  const unlimited = limit === 0 || admin;
  return {
    billingEnabled: false, plan: 'unlimited', planName: P.planName('unlimited'), endsAt: null, upcoming: [], trial: null,
    features: P.UNLIMITED_FEATURES, passesEnabled: false,
    chat: unlimited
      ? { used, limit: null, remaining: null, scope: 'day', resetsAt: null }
      : { used, limit, remaining: Math.max(limit - used, 0), scope: 'day', resetsAt: null },
  };
}

export async function getEntitlements(userId: string, now = new Date()): Promise<Entitlements> {
  const admin = await dbs.isAdmin(userId);
  if (!config.billing.enabled) return legacyEntitlements(userId, admin);

  const [passes, loaded] = await Promise.all([passesEnabled(), loadPeriods(userId)]);
  if (admin) {
    const used = await dbs.countChatMessagesOn(userId, todayIso(now), config.businessTimeZone);
    return {
      billingEnabled: true, plan: 'unlimited', planName: 'Admin: everything included', endsAt: null, upcoming: [], trial: null,
      features: P.UNLIMITED_FEATURES, passesEnabled: passes,
      chat: { used, limit: null, remaining: null, scope: 'day', resetsAt: null },
    };
  }

  const periods = await ensureTrial(userId, loaded, now);
  const active = P.activePeriod(periods, now);
  const plan: P.PlanId = active?.plan ?? 'free';
  const upcoming = P.queuedPeriods(periods, now)
    .filter((p): p is P.Period & { plan: P.PaidPlanId } => p.plan !== 'trial')
    .map((p) => ({ plan: p.plan, planName: P.planName(p.plan), startsAt: p.startsAt.toISOString(), endsAt: p.endsAt.toISOString() }));

  let chat: ChatAllowance;
  let trial: Entitlements['trial'] = null;
  if (!active) {
    chat = { used: 0, limit: 0, remaining: 0, scope: 'none', resetsAt: null };
  } else {
    const rule = P.chatRule(active.plan);
    if ('perDay' in rule) {
      // Today's messages since this plan started, so a morning on the trial doesn't eat into
      // a Monthly plan paid for in the afternoon.
      const { used, midnight } = await countMessages(userId, active.startsAt, todayIso(now));
      chat = { used, limit: rule.perDay, remaining: Math.max(rule.perDay - used, 0), scope: 'day', resetsAt: midnight };
    } else {
      const { used } = await countMessages(userId, active.startsAt, null);
      chat = { used, limit: rule.perPeriod, remaining: Math.max(rule.perPeriod - used, 0), scope: 'period', resetsAt: active.endsAt.toISOString() };
    }
    if (active.plan === 'trial') trial = { endsAt: active.endsAt.toISOString(), messagesLeft: chat.remaining ?? 0 };
  }

  return {
    billingEnabled: true,
    plan,
    planName: P.planName(plan),
    endsAt: active ? P.coveredUntil(active, periods).toISOString() : null,
    upcoming,
    trial,
    features: P.featuresFor(plan),
    chat,
    passesEnabled: passes,
  };
}

/** The 402 an owner gets for a feature their plan doesn't include. */
export function lockedError(feature: P.Feature | 'shops'): AppError {
  return new AppError(402, 'PLAN_REQUIRED', P.LOCKED_MESSAGES[feature], [{ field: 'feature', message: feature }]);
}

/** Why the assistant won't take another message, in plain words. */
export function chatRefusal(e: Entitlements): AppError {
  const c = e.chat;
  if (c.scope === 'none') return lockedError('assistant');
  if (e.plan === 'trial') {
    return new AppError(402, 'PLAN_REQUIRED',
      `You've used the ${c.limit} assistant messages that come with the free trial. Choose a plan to keep using the assistant — ` +
      'or record sales with the Add transaction form, which is always free.', [{ field: 'feature', message: 'assistant' }]);
  }
  if (c.scope === 'period') {
    return new AppError(429, 'DAILY_LIMIT',
      `You've used the ${c.limit} messages on your day pass. You can still record sales with the Add transaction form.`);
  }
  return new AppError(429, 'DAILY_LIMIT',
    `You've used today's ${c.limit} messages to the assistant. They start again at midnight. ` +
    'You can still record sales with the Add transaction form.');
}

// ── Plans on offer ───────────────────────────────────────────

export interface PlanOffer {
  id: P.PaidPlanId;
  name: string;
  priceKobo: number;
  priceText: string;
  days: number;
  messages: string;
  summary: string;
  pass: boolean;
}

export function offers(passes: boolean): PlanOffer[] {
  return P.PAID_PLAN_IDS
    .map((id) => P.PAID_PLANS[id])
    .filter((p) => !p.pass || passes)
    .map((p) => ({
      id: p.id, name: p.name, priceKobo: p.priceKobo, priceText: P.nairaText(p.priceKobo), days: p.hours / 24,
      messages: 'perDay' in p.chat ? `${p.chat.perDay} a day` : `${p.chat.perPeriod} in 24 hours`,
      summary: p.summary, pass: p.pass,
    }));
}

// ── Payments ─────────────────────────────────────────────────

export interface PaymentRecord {
  id: string;
  plan: P.PaidPlanId;
  planName: string;
  amountKobo: number;
  amountText: string;
  provider: 'paystack' | 'manual';
  status: 'pending' | 'success' | 'failed';
  channel: string | null;
  reference: string;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
  period: { startsAt: string; endsAt: string } | null;
}

function mapPayment(r: Record<string, unknown>): PaymentRecord {
  const plan = r['plan'] as P.PaidPlanId;
  const amount = Number(r['amount_kobo']);
  return {
    id: r['id'] as string, plan, planName: P.planName(plan), amountKobo: amount, amountText: P.nairaText(amount),
    provider: r['provider'] as PaymentRecord['provider'], status: r['status'] as PaymentRecord['status'],
    channel: (r['channel'] as string | null) ?? null, reference: r['reference'] as string, note: (r['note'] as string | null) ?? null,
    paidAt: r['paid_at'] ? (r['paid_at'] as Date).toISOString() : null, createdAt: (r['created_at'] as Date).toISOString(),
    period: r['starts_at'] ? { startsAt: (r['starts_at'] as Date).toISOString(), endsAt: (r['ends_at'] as Date).toISOString() } : null,
  };
}

const PAYMENT_SELECT = `
  SELECT p.*, s.starts_at, s.ends_at FROM payments p LEFT JOIN subscriptions s ON s.payment_id = p.id`;

export async function listPayments(userId: string, limit = 20): Promise<PaymentRecord[]> {
  const { rows } = await db.query(
    `${PAYMENT_SELECT} WHERE p.user_id = $1 AND p.status <> 'failed' ORDER BY p.created_at DESC LIMIT $2`, [userId, limit],
  );
  // A checkout the owner never finished stays 'pending' forever; after a day it's just noise.
  return rows.map(mapPayment).filter((p) => p.status !== 'pending' || Date.now() - Date.parse(p.createdAt) < 86_400_000);
}

/** Spent on full-capacity passes this calendar month, to point out when Monthly would be cheaper. */
export async function passSpendThisMonth(userId: string, now = new Date()): Promise<number> {
  const month = todayIso(now).slice(0, 7);
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(amount_kobo), 0) AS total FROM payments
      WHERE user_id = $1 AND status = 'success' AND plan IN ('weekly', 'day')
        AND to_char(paid_at AT TIME ZONE $2, 'YYYY-MM') = $3`,
    [userId, config.businessTimeZone, month],
  );
  return Number(rows[0]!['total']);
}

async function inTransaction<T>(fn: (client: Queryable) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Adds the plan period a successful payment pays for. Runs inside a transaction holding the
 * owner's row, so two grants for the same owner line up one after the other.
 */
async function addPeriod(client: Queryable, userId: string, plan: P.PaidPlanId, paymentId: string, now: Date): Promise<P.Period> {
  const periods = await loadPeriods(userId, client);
  const { startsAt, endsAt } = P.nextPeriod(plan, periods, now);
  const { rows } = await client.query(
    `INSERT INTO subscriptions (user_id, plan, starts_at, ends_at, payment_id) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, plan, starts_at, ends_at`,
    [userId, plan, startsAt, endsAt, paymentId],
  );
  return mapPeriod(rows[0]);
}

export interface Checkout { authorizationUrl: string; reference: string; startsAt: string; endsAt: string }

export async function startCheckout(userId: string, plan: P.PaidPlanId, now = new Date()): Promise<Checkout> {
  if (!config.billing.enabled) throw new AppError(400, 'BAD_REQUEST', 'Payments aren’t switched on yet. Everything is free for now.');
  if (P.PAID_PLANS[plan].pass && !(await passesEnabled())) throw new AppError(400, 'BAD_REQUEST', 'That plan isn’t on offer yet.');
  if (!paystack.paystackConfigured()) {
    throw new AppError(503, 'PAYMENTS_UNAVAILABLE', 'Online payment isn’t set up yet. Contact us to pay by bank transfer, and we’ll switch your plan on.');
  }
  const user = await dbs.findUserById(userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Account not found');

  const price = P.PAID_PLANS[plan].priceKobo;
  const reference = `bk_${plan}_${crypto.randomBytes(9).toString('hex')}`;
  const { rows } = await db.query(
    `INSERT INTO payments (user_id, plan, amount_kobo, provider, reference) VALUES ($1, $2, $3, 'paystack', $4) RETURNING id`,
    [userId, plan, price, reference],
  );
  let page: paystack.InitializeResult;
  try {
    page = await paystack.initializeTransaction({
      email: user.email, amountKobo: price, reference,
      callbackUrl: `${config.cors.frontendUrl.replace(/\/$/, '')}/billing`,
      metadata: { userId, plan, paymentId: rows[0].id, cancel_action: `${config.cors.frontendUrl.replace(/\/$/, '')}/billing` },
    });
  } catch (err) {
    await db.query(`UPDATE payments SET status = 'failed', note = $2 WHERE id = $1`, [rows[0].id, 'Paystack checkout could not start']);
    console.error('[billing] checkout failed:', err instanceof Error ? err.message : err);
    throw new AppError(502, 'PAYMENTS_UNAVAILABLE', 'Couldn’t reach Paystack. Check your connection and try again in a moment.');
  }
  // Shown before paying: when the time would start (later, if paying ahead).
  const preview = P.nextPeriod(plan, await loadPeriods(userId), now);
  return { authorizationUrl: page.authorization_url, reference, startsAt: preview.startsAt.toISOString(), endsAt: preview.endsAt.toISOString() };
}

export type Confirmation =
  | { status: 'success'; payment: PaymentRecord }
  | { status: 'pending' | 'failed'; payment: PaymentRecord }
  | { status: 'not_found' };

/**
 * Asks Paystack what happened to a payment and, if the money arrived, adds the plan. Safe to
 * call any number of times for the same reference. `userId` limits it to that owner's own
 * payments (the browser coming back); the webhook passes none.
 */
export async function confirmPaystackPayment(reference: string, userId?: string, now = new Date()): Promise<Confirmation> {
  const find = async () => {
    const { rows } = await db.query(
      `${PAYMENT_SELECT} WHERE p.reference = $1 AND p.provider = 'paystack' AND ($2::uuid IS NULL OR p.user_id = $2::uuid)`,
      [reference, userId ?? null],
    );
    return rows[0] ? mapPayment(rows[0]) : null;
  };
  const before = await find();
  if (!before) return { status: 'not_found' };
  if (before.status === 'success') return { status: 'success', payment: before };

  const result = await paystack.verifyTransaction(reference);
  const ok = result.status === 'success' && result.reference === reference
    && Number(result.amount) === before.amountKobo && result.currency === 'NGN';

  if (!ok) {
    if (result.status === 'success') {
      // Paid, but not what this checkout asked for: never unlock on it. Someone needs to look.
      console.error(`[billing] payment ${reference} came back as ${result.amount} ${result.currency}; expected ${before.amountKobo} NGN`);
      await db.query(`UPDATE payments SET status = 'failed', note = $2 WHERE id = $1 AND status = 'pending'`,
        [before.id, `Paystack reported ${result.amount} ${result.currency}, expected ${before.amountKobo} NGN`]);
    } else if (result.status === 'failed' || result.status === 'reversed') {
      await db.query(`UPDATE payments SET status = 'failed' WHERE id = $1 AND status = 'pending'`, [before.id]);
    }
    const after = (await find())!;
    return { status: after.status === 'failed' ? 'failed' : 'pending', payment: after };
  }

  await inTransaction(async (c) => {
    await c.query('SELECT id FROM users WHERE id = (SELECT user_id FROM payments WHERE id = $1) FOR UPDATE', [before.id]);
    const { rows } = await c.query('SELECT status, user_id, plan FROM payments WHERE id = $1 FOR UPDATE', [before.id]);
    if (rows[0]['status'] === 'success') return; // the webhook or the browser got here first
    await c.query(
      `UPDATE payments SET status = 'success', paid_at = $2, channel = $3, note = NULL WHERE id = $1`,
      [before.id, result.paid_at ? new Date(result.paid_at) : now, result.channel ?? null],
    );
    await addPeriod(c, rows[0]['user_id'] as string, rows[0]['plan'] as P.PaidPlanId, before.id, now);
  });
  return { status: 'success', payment: (await find())! };
}

/** A webhook from Paystack. Only charge.success matters; everything is re-checked with Paystack. */
export async function handleWebhook(rawBody: Buffer, signature: unknown): Promise<'ignored' | 'confirmed' | 'invalid'> {
  if (!paystack.validWebhookSignature(rawBody, signature)) return 'invalid';
  let event: { event?: string; data?: { reference?: unknown } };
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return 'ignored';
  }
  if (event.event !== 'charge.success' || typeof event.data?.reference !== 'string') return 'ignored';
  const result = await confirmPaystackPayment(event.data.reference);
  return result.status === 'success' ? 'confirmed' : 'ignored';
}

/** Money paid straight to the business's account, recorded by an admin. Unlocks the plan at once. */
export async function recordManualPayment(input: {
  adminId: string; userId: string; plan: P.PaidPlanId; amountKobo?: number; note?: string; now?: Date;
}): Promise<PaymentRecord> {
  const now = input.now ?? new Date();
  const amount = input.amountKobo ?? P.PAID_PLANS[input.plan].priceKobo;
  const id = await inTransaction(async (c) => {
    const { rows: user } = await c.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [input.userId]);
    if (!user[0]) throw new AppError(404, 'NOT_FOUND', 'Account not found');
    const { rows } = await c.query(
      `INSERT INTO payments (user_id, plan, amount_kobo, provider, reference, status, paid_at, recorded_by, note)
       VALUES ($1, $2, $3, 'manual', $4, 'success', $5, $6, $7) RETURNING id`,
      [input.userId, input.plan, amount, `manual_${crypto.randomBytes(9).toString('hex')}`, now, input.adminId, input.note?.trim() || null],
    );
    await addPeriod(c, input.userId, input.plan, rows[0].id as string, now);
    return rows[0].id as string;
  });
  const { rows } = await db.query(`${PAYMENT_SELECT} WHERE p.id = $1`, [id]);
  return mapPayment(rows[0]);
}

// ── Reminders before a plan ends ─────────────────────────────

/** Days of warning before a plan ends. Passes are short and bought on purpose, so no reminder. */
const REMIND_DAYS: Record<'trial' | 'subscription', number> = { trial: 2, subscription: 3 };

/**
 * Raises one 'plan_ending' alert for each trial or Monthly/Yearly period that is about to end
 * with nothing paid to follow it, and closes those that were renewed or ended a few days ago.
 */
export async function scanPlans(now = new Date()): Promise<{ raised: number; resolved: number }> {
  if (!config.billing.enabled) return { raised: 0, resolved: 0 };
  const horizon = new Date(now.getTime() + REMIND_DAYS.subscription * 86_400_000);
  const { rows } = await db.query(
    `SELECT s.id, s.user_id, s.plan, s.starts_at, s.ends_at,
            (SELECT sh.id FROM shops sh WHERE sh.owner_id = s.user_id ORDER BY sh.created_at LIMIT 1) AS shop_id
       FROM subscriptions s JOIN users u ON u.id = s.user_id
      WHERE NOT u.is_admin AND s.plan IN ('trial', 'monthly', 'yearly')
        AND s.starts_at <= $1 AND s.ends_at > $1 AND s.ends_at <= $2`,
    [now, horizon],
  );

  let raised = 0;
  const due = new Set<string>();
  for (const r of rows) {
    const period = mapPeriod(r);
    const days = REMIND_DAYS[period.plan === 'trial' ? 'trial' : 'subscription'];
    if (period.endsAt.getTime() - now.getTime() > days * 86_400_000) continue;
    const periods = await loadPeriods(r['user_id'] as string);
    // Renewed already (or, for the trial, any paid plan bought): nothing to say.
    const continued = period.plan === 'trial'
      ? periods.some((p) => p.plan !== 'trial' && p.endsAt > period.endsAt)
      : P.coveredUntil(period, periods) > period.endsAt;
    if (continued || !r['shop_id']) continue;
    const key = `plan_ending:${period.id}`;
    due.add(key);
    const when = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', timeZone: config.businessTimeZone }).format(period.endsAt);
    const message = period.plan === 'trial'
      ? `Your free trial ends on ${when}. Choose a plan to keep the assistant, PDF reports and receipts with your logo. Your records stay either way.`
      : `Your ${P.planName(period.plan)} plan ends on ${when}. Renew it to keep the assistant, PDF reports and receipts with your logo. Your records stay either way.`;
    const { rowCount } = await db.query(
      `INSERT INTO alerts (user_id, shop_id, type, message, metadata, source_key)
       VALUES ($1, $2, 'plan_ending', $3, $4, $5)
       ON CONFLICT (source_key) WHERE source_key IS NOT NULL AND status <> 'resolved' DO NOTHING`,
      [r['user_id'], r['shop_id'], message, JSON.stringify({ subscriptionId: period.id, plan: period.plan, endsAt: period.endsAt }), key],
    );
    raised += rowCount ?? 0;
  }

  // Close reminders whose plan was renewed, or that ended more than three days ago.
  const { rows: open } = await db.query(
    `SELECT a.id, a.source_key, s.ends_at FROM alerts a
       LEFT JOIN subscriptions s ON s.id::text = a.metadata->>'subscriptionId'
      WHERE a.type = 'plan_ending' AND a.status <> 'resolved'`,
  );
  const stale = open
    .filter((a) => !due.has(a['source_key'] as string)
      && (!a['ends_at'] || (a['ends_at'] as Date) > now || now.getTime() - (a['ends_at'] as Date).getTime() > 3 * 86_400_000))
    .map((a) => a['id'] as string);
  let resolved = 0;
  if (stale.length) {
    const { rowCount } = await db.query(`UPDATE alerts SET status = 'resolved' WHERE id = ANY($1::uuid[])`, [stale]);
    resolved = rowCount ?? 0;
  }
  return { raised, resolved };
}

// ── For the business dashboard ───────────────────────────────

export interface BillingOverview {
  billingEnabled: boolean;
  paystackConfigured: boolean;
  passesEnabled: boolean;
  revenueThisMonthKobo: number;
  paymentsThisMonth: number;
  revenueLast30Kobo: number;
  payingOwners: number;
  byPlan: { plan: P.PaidPlanId; planName: string; owners: number }[];
  onTrial: number;
  trialsEnded30: number;
  trialsConverted30: number;
  recent: (PaymentRecord & { ownerName: string; ownerEmail: string })[];
}

/** The plan in force for each owner right now, highest-ranked first; as SQL for the dashboard. */
const ACTIVE_PLAN_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT s.plan, s.ends_at FROM subscriptions s
     WHERE s.user_id = u.id AND s.starts_at <= NOW() AND s.ends_at > NOW()
     ORDER BY CASE WHEN s.plan = 'trial' THEN 1 WHEN s.plan IN ('weekly', 'day') THEN 3 ELSE 2 END DESC, s.ends_at DESC
     LIMIT 1
  ) cur ON true`;

export async function getBillingOverview(now = new Date()): Promise<BillingOverview> {
  const tz = config.businessTimeZone;
  const month = todayIso(now).slice(0, 7);
  const [money, plans, trials, recent, passes] = await Promise.all([
    db.query(
      `SELECT COALESCE(SUM(amount_kobo) FILTER (WHERE to_char(paid_at AT TIME ZONE $1, 'YYYY-MM') = $2), 0) AS month_total,
              COUNT(*) FILTER (WHERE to_char(paid_at AT TIME ZONE $1, 'YYYY-MM') = $2) AS month_count,
              COALESCE(SUM(amount_kobo) FILTER (WHERE paid_at > $3::timestamptz - interval '30 days'), 0) AS last30
         FROM payments WHERE status = 'success'`,
      [tz, month, now],
    ),
    db.query(
      `SELECT cur.plan, COUNT(*) AS owners FROM users u ${ACTIVE_PLAN_LATERAL}
        WHERE NOT u.is_admin AND cur.plan IS NOT NULL GROUP BY cur.plan`,
    ),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE t.ends_at <= $1 AND t.ends_at > $1::timestamptz - interval '30 days') AS ended,
              COUNT(*) FILTER (WHERE t.ends_at <= $1 AND t.ends_at > $1::timestamptz - interval '30 days'
                AND EXISTS (SELECT 1 FROM payments p WHERE p.user_id = t.user_id AND p.status = 'success')) AS converted
         FROM subscriptions t JOIN users u ON u.id = t.user_id
        WHERE t.plan = 'trial' AND NOT u.is_admin`,
      [now],
    ),
    db.query(
      `${PAYMENT_SELECT.replace('FROM payments p', 'FROM payments p JOIN users u ON u.id = p.user_id').replace('SELECT p.*,', 'SELECT p.*, u.name AS owner_name, u.email AS owner_email,')}
        WHERE p.status = 'success' ORDER BY p.paid_at DESC LIMIT 10`,
    ),
    passesEnabled(),
  ]);

  const counts = new Map(plans.rows.map((r) => [r['plan'] as string, Number(r['owners'])]));
  const byPlan = P.PAID_PLAN_IDS.map((plan) => ({ plan, planName: P.planName(plan), owners: counts.get(plan) ?? 0 }));
  const m = money.rows[0]!;
  return {
    billingEnabled: config.billing.enabled,
    paystackConfigured: paystack.paystackConfigured(),
    passesEnabled: passes,
    revenueThisMonthKobo: Number(m['month_total']),
    paymentsThisMonth: Number(m['month_count']),
    revenueLast30Kobo: Number(m['last30']),
    payingOwners: byPlan.reduce((s, p) => s + p.owners, 0),
    byPlan,
    onTrial: counts.get('trial') ?? 0,
    trialsEnded30: Number(trials.rows[0]!['ended']),
    trialsConverted30: Number(trials.rows[0]!['converted']),
    recent: recent.rows.map((r) => ({ ...mapPayment(r), ownerName: r['owner_name'] as string, ownerEmail: r['owner_email'] as string })),
  };
}

/** Each owner's current plan, for the dashboard's user list. */
export async function currentPlans(userIds: string[]): Promise<Map<string, { plan: P.PlanId; endsAt: string | null; paidKobo: number }>> {
  const map = new Map<string, { plan: P.PlanId; endsAt: string | null; paidKobo: number }>();
  if (!userIds.length) return map;
  const { rows } = await db.query(
    `SELECT u.id, cur.plan, cur.ends_at,
            (SELECT COALESCE(SUM(amount_kobo), 0) FROM payments p WHERE p.user_id = u.id AND p.status = 'success') AS paid
       FROM users u ${ACTIVE_PLAN_LATERAL} WHERE u.id = ANY($1::uuid[])`,
    [userIds],
  );
  for (const r of rows) {
    map.set(r['id'] as string, {
      plan: (r['plan'] as P.PlanId | null) ?? 'free',
      endsAt: r['ends_at'] ? (r['ends_at'] as Date).toISOString() : null,
      paidKobo: Number(r['paid']),
    });
  }
  return map;
}
