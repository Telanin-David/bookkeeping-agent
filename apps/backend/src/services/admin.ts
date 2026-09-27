import { config, db } from '../config';
import { todayIso, addDays } from '../utils/dates';

// The business dashboard's numbers. Counts and costs only: nothing here reads a shop's
// amounts, customers or descriptions.
//
// "Active" means the owner opened the app that day (user_active_days). Admin accounts are
// left out of the user, activity, return and accuracy numbers, so testing doesn't skew
// them, but AI spending includes them: that's the bill.

const WINDOW_DAYS = 30;
const RETURN_AFTER_DAYS = [7, 14, 28] as const;

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

/** Local (Lagos) calendar day of a timestamp column, as SQL. $1 is always the time zone. */
const day = (col: string) => `(${col} AT TIME ZONE $1)::date`;

export interface DashboardOverview {
  today: string;
  windowStart: string;
  users: { total: number; verified: number; newInWindow: number; activeToday: number; active7: number; active30: number };
  ai: {
    messagesToday: number; costToday: number;
    messages: number; cost: number; failed: number; costPerMessage: number | null;
    chatUsers: number; costPerChatUser: number | null;
    monthToDate: number; monthProjected: number;
    daily: { day: string; messages: number; cost: number }[];
  };
  accuracy: { recorded: number; corrected: number; rate: number | null };
  returning: { afterDays: number; eligible: number; returned: number }[];
  emails: { sent: number; failed: number };
}

export async function getOverview(now = new Date()): Promise<DashboardOverview> {
  const tz = config.businessTimeZone;
  const today = todayIso(now);
  const from = addDays(today, -(WINDOW_DAYS - 1));
  const monthStart = `${today.slice(0, 8)}01`;
  const p = [tz, today, from];

  const [users, active, ai, daily, corrections, recorded, returning, emails] = await Promise.all([
    db.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE email_verified) AS verified,
              COUNT(*) FILTER (WHERE ${day('created_at')} >= $2) AS new_in_window
         FROM users WHERE NOT is_admin`,
      [tz, from],
    ),
    db.query(
      `SELECT COUNT(DISTINCT a.user_id) FILTER (WHERE a.day = $1) AS today,
              COUNT(DISTINCT a.user_id) FILTER (WHERE a.day >= $1::date - 6) AS d7,
              COUNT(DISTINCT a.user_id) AS d30
         FROM user_active_days a JOIN users u ON u.id = a.user_id
        WHERE a.day >= $2 AND NOT u.is_admin`,
      [today, from],
    ),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE d = $2 AND NOT failed) AS messages_today,
              COALESCE(SUM(cost_usd) FILTER (WHERE d = $2), 0) AS cost_today,
              COUNT(*) FILTER (WHERE d >= $3 AND NOT failed) AS messages,
              COALESCE(SUM(cost_usd) FILTER (WHERE d >= $3), 0) AS cost,
              COUNT(*) FILTER (WHERE d >= $3 AND failed) AS failed,
              COUNT(DISTINCT user_id) FILTER (WHERE d >= $3 AND NOT failed) AS chat_users,
              COALESCE(SUM(cost_usd) FILTER (WHERE d >= $4), 0) AS month_to_date
         FROM (SELECT *, ${day('created_at')} AS d FROM ai_usage) u
        WHERE d >= LEAST($3::date, $4::date)`,
      [...p, monthStart],
    ),
    db.query(
      `SELECT to_char(g.d, 'YYYY-MM-DD') AS day,
              COUNT(u.id) FILTER (WHERE NOT u.failed) AS messages,
              COALESCE(SUM(u.cost_usd), 0) AS cost
         FROM generate_series($3::date, $2::date, interval '1 day') AS g(d)
         LEFT JOIN ai_usage u ON ${day('u.created_at')} = g.d::date
        GROUP BY g.d ORDER BY g.d`,
      p,
    ),
    db.query(
      `SELECT COUNT(DISTINCT c.transaction_id) AS corrected
         FROM ai_corrections c JOIN users u ON u.id = c.user_id
        WHERE ${day('c.created_at')} BETWEEN $3 AND $2 AND NOT u.is_admin`,
      p,
    ),
    db.query(
      `SELECT COALESCE(SUM(a.recorded), 0) AS recorded
         FROM ai_usage a JOIN users u ON u.id = a.user_id
        WHERE ${day('a.created_at')} BETWEEN $3 AND $2 AND NOT u.is_admin`,
      p,
    ),
    // Of the owners who signed up at least N days ago, how many opened the app again N or more days in.
    db.query(
      `SELECT n.after AS after_days,
              COUNT(u.id) AS eligible,
              COUNT(u.id) FILTER (WHERE EXISTS (
                SELECT 1 FROM user_active_days a WHERE a.user_id = u.id AND a.day >= u.signup + n.after
              )) AS returned
         FROM unnest($3::int[]) AS n(after)
         LEFT JOIN (SELECT id, ${day('created_at')} AS signup FROM users WHERE NOT is_admin) u
                ON u.signup <= $2::date - n.after
        GROUP BY n.after ORDER BY n.after`,
      [tz, today, [...RETURN_AFTER_DAYS]],
    ),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'sent') AS sent,
              COUNT(*) FILTER (WHERE status = 'failed') AS failed
         FROM alert_history WHERE channel = 'email' AND ${day('created_at')} BETWEEN $3 AND $2`,
      p,
    ),
  ]);

  const a = ai.rows[0]!;
  const messages = num(a['messages']);
  const cost = num(a['cost']);
  const chatUsers = num(a['chat_users']);
  const monthToDate = num(a['month_to_date']);
  const dayOfMonth = Number(today.slice(8, 10));
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rec = num(recorded.rows[0]!['recorded']);
  const corrected = num(corrections.rows[0]!['corrected']);

  return {
    today,
    windowStart: from,
    users: {
      total: num(users.rows[0]!['total']),
      verified: num(users.rows[0]!['verified']),
      newInWindow: num(users.rows[0]!['new_in_window']),
      activeToday: num(active.rows[0]!['today']),
      active7: num(active.rows[0]!['d7']),
      active30: num(active.rows[0]!['d30']),
    },
    ai: {
      messagesToday: num(a['messages_today']),
      costToday: num(a['cost_today']),
      messages,
      cost,
      failed: num(a['failed']),
      costPerMessage: messages ? cost / messages : null,
      chatUsers,
      costPerChatUser: chatUsers ? cost / chatUsers : null,
      monthToDate,
      monthProjected: (monthToDate / dayOfMonth) * daysInMonth,
      daily: daily.rows.map((r) => ({ day: r['day'] as string, messages: num(r['messages']), cost: num(r['cost']) })),
    },
    accuracy: { recorded: rec, corrected, rate: rec ? Math.min(corrected / rec, 1) : null },
    returning: returning.rows.map((r) => ({
      afterDays: num(r['after_days']), eligible: num(r['eligible']), returned: num(r['returned']),
    })),
    emails: { sent: num(emails.rows[0]!['sent']), failed: num(emails.rows[0]!['failed']) },
  };
}

export interface DashboardUser {
  id: string; name: string; email: string; signedUp: string; emailVerified: boolean; isAdmin: boolean;
  shops: number; lastActive: string | null; activeDays: number;
  messages: number; cost: number; recorded: number; corrected: number;
}

const USER_LIMIT = 200;

/** Every account, most expensive first, with its last 30 days of use. */
export async function listUsers(now = new Date()): Promise<{ data: DashboardUser[]; total: number; limit: number }> {
  const tz = config.businessTimeZone;
  const today = todayIso(now);
  const from = addDays(today, -(WINDOW_DAYS - 1));
  const [{ rows }, count] = await Promise.all([
    db.query(
      `SELECT u.id, u.name, u.email, to_char(${day('u.created_at')}, 'YYYY-MM-DD') AS signed_up,
              u.email_verified, u.is_admin,
              (SELECT COUNT(*) FROM shops s WHERE s.owner_id = u.id) AS shops,
              (SELECT to_char(MAX(a.day), 'YYYY-MM-DD') FROM user_active_days a WHERE a.user_id = u.id) AS last_active,
              (SELECT COUNT(*) FROM user_active_days a WHERE a.user_id = u.id AND a.day BETWEEN $3 AND $2) AS active_days,
              COALESCE(x.messages, 0) AS messages, COALESCE(x.cost, 0) AS cost, COALESCE(x.recorded, 0) AS recorded,
              (SELECT COUNT(DISTINCT c.transaction_id) FROM ai_corrections c
                WHERE c.user_id = u.id AND ${day('c.created_at')} BETWEEN $3 AND $2) AS corrected
         FROM users u
         LEFT JOIN LATERAL (
           SELECT COUNT(*) FILTER (WHERE NOT g.failed) AS messages, SUM(g.cost_usd) AS cost, SUM(g.recorded) AS recorded
             FROM ai_usage g WHERE g.user_id = u.id AND ${day('g.created_at')} BETWEEN $3 AND $2
         ) x ON true
        ORDER BY COALESCE(x.cost, 0) DESC, last_active DESC NULLS LAST, u.created_at DESC
        LIMIT $4`,
      [tz, today, from, USER_LIMIT],
    ),
    db.query('SELECT COUNT(*) AS n FROM users'),
  ]);
  return {
    data: rows.map((r) => ({
      id: r['id'] as string,
      name: r['name'] as string,
      email: r['email'] as string,
      signedUp: r['signed_up'] as string,
      emailVerified: r['email_verified'] as boolean,
      isAdmin: r['is_admin'] as boolean,
      shops: num(r['shops']),
      lastActive: (r['last_active'] as string | null) ?? null,
      activeDays: num(r['active_days']),
      messages: num(r['messages']),
      cost: num(r['cost']),
      recorded: num(r['recorded']),
      corrected: num(r['corrected']),
    })),
    total: num(count.rows[0]!['n']),
    limit: USER_LIMIT,
  };
}
