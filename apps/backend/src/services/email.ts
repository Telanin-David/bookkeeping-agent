// Outgoing email. SMTP works with any provider, so changing provider is a config change.
// Without SMTP settings, development writes each email to an .eml file (open it in any
// mail app) and production sends nothing, logging that it skipped.

import fs from 'fs/promises';
import path from 'path';
import { createTransport } from 'nodemailer';
import { config } from '../config';
import type { Alert } from '../types';

type Delivery = 'sent' | 'outbox' | 'skipped';

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
  headers?: Record<string, string>;
}

const smtp = config.email.smtpHost
  ? createTransport({
      host: config.email.smtpHost,
      port: config.email.smtpPort,
      secure: config.email.smtpSecure,
      auth: config.email.smtpUser ? { user: config.email.smtpUser, pass: config.email.smtpPass } : undefined,
      // Don't hang the alert worker on a dead mail server.
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    })
  : null;

const outbox = createTransport({ streamTransport: true, buffer: true, newline: 'unix' });

let warnedSkipping = false;

/** Throws if the mail server refuses or can't be reached, so callers can record the failure and retry. */
export async function sendMail(mail: Mail): Promise<Delivery> {
  const message = { from: config.email.from, ...mail };
  if (smtp) {
    await smtp.sendMail(message);
    return 'sent';
  }
  if (config.nodeEnv === 'production') {
    if (!warnedSkipping) console.warn('[email] SMTP_HOST is not set — emails are not being sent');
    warnedSkipping = true;
    return 'skipped';
  }
  const info = await outbox.sendMail(message);
  await fs.mkdir(config.email.outboxDir, { recursive: true });
  const safeTo = mail.to.replace(/[^a-z0-9@._-]/gi, '_');
  await fs.writeFile(path.join(config.email.outboxDir, `${Date.now()}-${safeTo}.eml`), info.message as Buffer);
  return 'outbox';
}

// ── Templates ────────────────────────────────────────────────

/** Names, products and messages come from users: escape them before they go into HTML. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const appUrl = (p: string) => `${config.cors.frontendUrl.replace(/\/$/, '')}${p}`;

function layout(heading: string, bodyHtml: string, footerHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:12px">
<tr><td style="padding:28px 28px 8px"><p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#777">Bookkeeping AI</p>
<h1 style="margin:0;font-size:20px;line-height:1.3">${esc(heading)}</h1></td></tr>
<tr><td style="padding:12px 28px 24px;font-size:15px;line-height:1.55">${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #eee;font-size:12px;line-height:1.5;color:#888">${footerHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0 4px"><a href="${esc(href)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600">${esc(label)}</a></p>`;
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<Delivery> {
  const link = appUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  return sendMail({
    to,
    subject: 'Confirm your email for Bookkeeping AI',
    html: layout(
      'Confirm your email',
      `<p style="margin:0">Hi ${esc(name)}, tap the button to confirm this is your email address. After that, alerts about your shop (money owed to you, bills due, low stock) can reach you here.</p>${button(link, 'Confirm my email')}
<p style="margin:12px 0 0;font-size:13px;color:#777">The link works for 48 hours. If you didn't sign up for Bookkeeping AI, ignore this email.</p>`,
      'You received this because this address was used to sign up for Bookkeeping AI.',
    ),
    text: `Hi ${name},\n\nConfirm your email for Bookkeeping AI by opening this link (it works for 48 hours):\n${link}\n\nIf you didn't sign up, ignore this email.`,
  });
}

export interface DigestAlert extends Pick<Alert, 'id' | 'type' | 'message' | 'createdAt'> {
  shopName: string;
}

const TYPE_LABELS: Partial<Record<Alert['type'], string>> = {
  overdue_receivable: 'Customer owes you',
  bill_due: 'Bill due',
  low_stock: 'Low stock',
};

/** One email for everything that's new, grouped by shop, so a busy day isn't a stream of emails. */
export async function sendAlertDigest(to: string, name: string, alerts: DigestAlert[]): Promise<Delivery> {
  // A big import of old debts can raise dozens at once: list the first few and point to the app.
  const MAX_LISTED = 10;
  const hidden = Math.max(0, alerts.length - MAX_LISTED);
  const total = alerts.length;
  alerts = alerts.slice(0, MAX_LISTED);
  const shops = [...new Set(alerts.map((a) => a.shopName))];
  const subject = total === 1
    ? alerts[0]!.message
    : `${total} things need your attention${shops.length === 1 ? ` at ${shops[0]}` : ''}`;
  const sections = shops.map((shop) => {
    const items = alerts.filter((a) => a.shopName === shop).map((a) =>
      `<li style="margin:0 0 10px"><span style="display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#888">${esc(TYPE_LABELS[a.type] ?? 'Alert')}</span>${esc(a.message)}</li>`,
    ).join('');
    return `${shops.length > 1 ? `<p style="margin:16px 0 6px;font-weight:600">${esc(shop)}</p>` : ''}<ul style="margin:8px 0 0;padding-left:18px">${items}</ul>`;
  }).join('');
  const settings = appUrl('/settings/alerts');
  return sendMail({
    to,
    subject: subject.length > 120 ? `${subject.slice(0, 117)}…` : subject,
    html: layout(
      total === 1 ? 'Something needs your attention' : `${total} things need your attention`,
      `<p style="margin:0">Hi ${esc(name)},</p>${sections}${hidden ? `<p style="margin:12px 0 0;color:#555">…and ${hidden} more in the app.</p>` : ''}${button(appUrl('/alerts'), 'Open your alerts')}`,
      `You get these because email alerts are on. <a href="${esc(settings)}" style="color:#888">Change or turn off alert emails</a>.`,
    ),
    text: `Hi ${name},\n\n${shops.map((shop) => `${shops.length > 1 ? `${shop}\n` : ''}${alerts.filter((a) => a.shopName === shop).map((a) => `- ${a.message}`).join('\n')}`).join('\n\n')}${hidden ? `\n…and ${hidden} more in the app.` : ''}\n\nOpen your alerts: ${appUrl('/alerts')}\nTurn off alert emails: ${settings}`,
    headers: { 'List-Unsubscribe': `<${settings}>` },
  });
}

export async function sendReportEmail(to: string, reportType: string, pdfBuffer: Buffer): Promise<Delivery> {
  return sendMail({
    to,
    subject: `Your ${reportType} report`,
    html: layout(`Your ${reportType} report`, '<p style="margin:0">Your report is attached as a PDF.</p>', 'Sent because you asked for this report in Bookkeeping AI.'),
    text: `Your ${reportType} report is attached as a PDF.`,
    attachments: [{
      filename: `${reportType.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  });
}
