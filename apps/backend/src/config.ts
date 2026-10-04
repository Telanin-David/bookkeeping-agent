import 'dotenv/config';
import { Pool, types } from 'pg';

// Postgres DATE columns (transaction date, due date) have no time or timezone. By default
// pg turns them into a JS Date at local midnight, and converting that back to text shifts
// the day on any server east of UTC — on a Lagos-time VPS a sale on the 25th read back
// as the 24th. Keep them as the 'YYYY-MM-DD' text Postgres sends.
const PG_DATE_OID = 1082;
types.setTypeParser(PG_DATE_OID, (value) => value);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const EXAMPLE_ACCESS_SECRET = 'change-me-to-a-long-random-string'; // the .env.example placeholder

/**
 * Anyone who knows this secret can forge an access token for any account, so production
 * refuses to start with a short one or the placeholder from .env.example.
 * Generate one with: openssl rand -base64 48
 */
function accessSecret(): string {
  const secret = required('JWT_ACCESS_SECRET');
  const production = (process.env['NODE_ENV'] ?? 'development') === 'production';
  if (production && (secret.length < 32 || secret === EXAMPLE_ACCESS_SECRET)) {
    throw new Error(
      'JWT_ACCESS_SECRET is too weak for production: use at least 32 random characters ' +
      '(generate one with: openssl rand -base64 48)',
    );
  }
  return secret;
}

/** Parses durations like '30s', '15m', '12h' or '7d' into milliseconds. */
function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration: ${value} (expected e.g. 15m, 12h, 7d)`);
  const unitMs = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return parseInt(match[1]!, 10) * unitMs;
}

function parseTrustProxy(value: string): number {
  const hops = Number(value.trim());
  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error(`Invalid TRUST_PROXY: ${value} (expected the number of proxies in front, e.g. 1 for nginx)`);
  }
  return hops;
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '4000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  isDev: (process.env['NODE_ENV'] ?? 'development') === 'development',

  db: {
    url: required('DATABASE_URL'),
  },

  jwt: {
    accessSecret: accessSecret(),
    accessExpiresIn: process.env['JWT_ACCESS_EXPIRES_IN'] ?? '15m',
    // Refresh tokens are opaque random strings stored hashed (not JWTs), so they need
    // no signing secret — only a lifetime.
    refreshTtlMs: parseDuration(process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d'),
  },

  anthropic: {
    apiKey: required('ANTHROPIC_API_KEY'),
    // The model behind the chat assistant. Sonnet 5.5 is the default because Haiku 4.5, the
    // cheapest, sometimes says it saved something without saving it (see services/claude.ts);
    // set CHAT_MODEL=claude-haiku-4-5 to trade that accuracy for about a third of the cost.
    chatModel: process.env['CHAT_MODEL'] || 'claude-sonnet-5-5',
    // Messages each owner can send the assistant per day (Lagos time), to cap the AI bill.
    // 0 turns the limit off. Admins are never limited.
    chatDailyLimit: Math.max(0, parseInt(process.env['CHAT_DAILY_LIMIT'] || '20', 10) || 0),
  },

  // Outgoing email over SMTP, which every email provider offers (Brevo, Amazon SES,
  // Zoho, Mailgun, SendGrid…), so switching provider is a config change. With no
  // SMTP_HOST, development writes emails to EMAIL_OUTBOX_DIR as .eml files instead,
  // and production sends nothing (and says so in the log).
  email: {
    smtpHost: process.env['SMTP_HOST'] ?? '',
    smtpPort: parseInt(process.env['SMTP_PORT'] ?? '587', 10),
    // true for port 465 (TLS from the start); 587 upgrades with STARTTLS.
    smtpSecure: (process.env['SMTP_SECURE'] ?? '') === 'true',
    smtpUser: process.env['SMTP_USER'] ?? '',
    smtpPass: process.env['SMTP_PASS'] ?? '',
    from: process.env['EMAIL_FROM'] ?? 'Bookkeeping AI <alerts@localhost>',
    outboxDir: process.env['EMAIL_OUTBOX_DIR'] ?? 'tmp/outbox',
  },

  // Background alert checks and email delivery. Off in tests; ALERT_WORKER=off also
  // turns it off (e.g. when a second backend instance runs on another server).
  alerts: {
    workerEnabled: (process.env['ALERT_WORKER'] ?? 'on') !== 'off' && (process.env['NODE_ENV'] ?? '') !== 'test',
    intervalMs: parseInt(process.env['ALERT_WORKER_INTERVAL_MS'] ?? String(10 * 60_000), 10),
    // At most one alert email per person in this window; newer alerts wait for the next one.
    emailGapMs: parseInt(process.env['ALERT_EMAIL_GAP_MS'] ?? String(60 * 60_000), 10),
  },

  twilio: {
    accountSid: process.env['TWILIO_ACCOUNT_SID'] ?? '',
    authToken: process.env['TWILIO_AUTH_TOKEN'] ?? '',
    fromNumber: process.env['TWILIO_FROM_NUMBER'] ?? '',
  },

  storage: {
    driver: (process.env['STORAGE_DRIVER'] ?? 'local') as 'local' | 's3',
    // Where the local driver keeps uploads (Excel imports, shop logos/signatures). On the
    // VPS, point this at a persistent folder that is included in backups.
    localDir: process.env['UPLOAD_DIR'] ?? 'tmp/uploads',
    s3Bucket: process.env['AWS_S3_BUCKET'] ?? '',
    s3Region: process.env['AWS_REGION'] ?? 'us-east-1',
  },

  // Calendar days ("today", due dates, report periods) are counted in this zone.
  businessTimeZone: process.env['BUSINESS_TIME_ZONE'] ?? 'Africa/Lagos',

  cors: {
    frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
  },

  // How many reverse proxies (e.g. nginx) sit in front of this server. Behind nginx,
  // every request arrives from 127.0.0.1; with this set, Express reads the visitor's
  // real IP from X-Forwarded-For instead — otherwise the per-IP login rate limit counts
  // the whole world as one visitor. Keep 0 when nothing is in front: trusting the
  // header then would let anyone fake their IP and dodge the limit.
  trustProxyHops: parseTrustProxy(process.env['TRUST_PROXY'] ?? '0'),
};

export const db = new Pool({
  connectionString: config.db.url,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
