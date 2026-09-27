// The alert worker: on a timer, checks debts and bills for new alerts, then emails what's
// new. One email per person per window (a digest), never during their quiet hours, and
// only to a confirmed address. Each attempt is written to alert_history, so an alert is
// emailed once, and a failure is retried up to MAX_EMAIL_ATTEMPTS times.

import { config, db } from '../config';
import { scanDebts } from './alerts';
import { scanSalaries } from './staff';
import { sendAlertDigest, type DigestAlert } from './email';
import { todayIso } from '../utils/dates';
import type { Alert } from '../types';

/** Worth an email. Duplicates are only useful in the moment, so they stay in the app. */
export const EMAILED_TYPES: Alert['type'][] = ['overdue_receivable', 'bill_due', 'low_stock', 'salary_due'];
const MAX_EMAIL_ATTEMPTS = 3;
/** An alert this old that was never emailed (e.g. the address was confirmed later) stays in the app only. */
const MAX_AGE_DAYS = 7;
/** Any number: it only has to be the same for every backend process. */
const WORKER_LOCK_ID = 80_235_117;

/** Minutes since midnight in the business time zone. */
function localMinutes(now: Date): number {
  const [h, m] = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.businessTimeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(now).split(':').map(Number);
  return h! * 60 + m!;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};

/** Quiet hours may wrap midnight (22:00–07:00). Equal start and end means no quiet time. */
export function inQuietHours(now: Date, quietStart: string, quietEnd: string): boolean {
  const t = localMinutes(now);
  const start = toMinutes(quietStart);
  const end = toMinutes(quietEnd);
  if (start === end) return false;
  return start < end ? t >= start && t < end : t >= start || t < end;
}

export interface DeliveryReport { users: number; emailed: number; failed: number; waiting: number }

export async function deliverAlertEmails(now = new Date()): Promise<DeliveryReport> {
  const { rows } = await db.query(
    `SELECT a.id, a.type, a.message, a.created_at, s.name AS shop_name,
            u.id AS user_id, u.name AS user_name, u.email, u.alert_quiet_start, u.alert_quiet_end
     FROM alerts a
     JOIN users u ON u.id = a.user_id
     JOIN shops s ON s.id = a.shop_id
     WHERE a.status = 'active' AND a.type = ANY($1) AND u.alert_email AND u.email_verified
       AND a.created_at > $2::timestamptz - make_interval(days => $3)
       AND NOT EXISTS (SELECT 1 FROM alert_history h WHERE h.alert_id = a.id AND h.channel = 'email' AND h.status = 'sent')
       AND (SELECT COUNT(*) FROM alert_history h WHERE h.alert_id = a.id AND h.channel = 'email' AND h.status = 'failed') < $4
     ORDER BY u.id, a.created_at`,
    [EMAILED_TYPES, now, MAX_AGE_DAYS, MAX_EMAIL_ATTEMPTS],
  );

  const byUser = new Map<string, typeof rows>();
  for (const r of rows) byUser.set(r['user_id'] as string, [...(byUser.get(r['user_id'] as string) ?? []), r]);

  const report: DeliveryReport = { users: byUser.size, emailed: 0, failed: 0, waiting: 0 };
  for (const [userId, alerts] of byUser) {
    const first = alerts[0]!;
    if (inQuietHours(now, String(first['alert_quiet_start']).slice(0, 5), String(first['alert_quiet_end']).slice(0, 5))) {
      report.waiting += 1;
      continue;
    }
    const { rows: last } = await db.query(
      `SELECT MAX(h.delivered_at) AS at FROM alert_history h JOIN alerts a ON a.id = h.alert_id
       WHERE a.user_id = $1 AND h.channel = 'email' AND h.status = 'sent'`,
      [userId],
    );
    const lastAt = last[0]?.['at'] as Date | null;
    if (lastAt && now.getTime() - lastAt.getTime() < config.alerts.emailGapMs) {
      report.waiting += 1; // folded into the next email instead
      continue;
    }

    const digest: DigestAlert[] = alerts.map((a) => ({
      id: a['id'] as string, type: a['type'] as Alert['type'], message: a['message'] as string,
      createdAt: a['created_at'] as Date, shopName: a['shop_name'] as string,
    }));
    try {
      const delivery = await sendAlertDigest(first['email'] as string, first['user_name'] as string, digest);
      if (delivery === 'skipped') continue; // no mail server configured: nothing recorded, so they go out once one is
      await recordAttempts(digest.map((a) => a.id), 'sent', now, null);
      report.emailed += 1;
    } catch (err) {
      const reason = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      await recordAttempts(digest.map((a) => a.id), 'failed', null, reason);
      console.error(`[alerts] email to user ${userId} failed: ${reason}`);
      report.failed += 1;
    }
  }
  return report;
}

async function recordAttempts(alertIds: string[], status: 'sent' | 'failed', deliveredAt: Date | null, error: string | null): Promise<void> {
  await db.query(
    `INSERT INTO alert_history (alert_id, channel, status, delivered_at, error_message)
     SELECT id, 'email', $2, $3, $4 FROM unnest($1::uuid[]) AS id`,
    [alertIds, status, deliveredAt, error],
  );
}

/**
 * One full cycle. A Postgres advisory lock makes sure only one backend process runs it at
 * a time, so two servers never email the same alert twice.
 */
export async function runAlertCycle(now = new Date()): Promise<{ ran: boolean; raised?: number; resolved?: number; delivery?: DeliveryReport }> {
  const client = await db.connect();
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [WORKER_LOCK_ID]);
    if (!rows[0]?.['locked']) return { ran: false };
    try {
      const debts = await scanDebts(todayIso(now));
      const salaries = await scanSalaries(todayIso(now));
      const [raised, resolved] = [debts.raised + salaries.raised, debts.resolved + salaries.resolved];
      const delivery = await deliverAlertEmails(now);
      return { ran: true, raised, resolved, delivery };
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [WORKER_LOCK_ID]);
    }
  } finally {
    client.release();
  }
}

let timer: NodeJS.Timeout | null = null;

export function startAlertWorker(): void {
  if (!config.alerts.workerEnabled || timer) return;
  const tick = () => {
    runAlertCycle()
      .then((r) => {
        if (r.ran && (r.raised || r.resolved || r.delivery?.emailed || r.delivery?.failed)) {
          console.log(`[alerts] raised ${r.raised}, resolved ${r.resolved}, emails sent ${r.delivery?.emailed}, failed ${r.delivery?.failed}`);
        }
      })
      .catch((err) => console.error('[alerts] cycle failed:', err instanceof Error ? err.message : err));
  };
  // First run shortly after start-up, then on the interval. unref: never keeps the process alive.
  setTimeout(tick, Math.min(30_000, config.alerts.intervalMs)).unref();
  timer = setInterval(tick, config.alerts.intervalMs);
  timer.unref();
}
