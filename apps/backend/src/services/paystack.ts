// The two Paystack calls the app needs, plus checking that a webhook really came from
// Paystack. https://paystack.com/docs/api/transaction/
//
//   initialize  creates a payment and returns the page where the owner pays (bank transfer,
//               card or USSD, all on Paystack's own page: card details never touch this app).
//   verify      asks Paystack, server to server, what happened to a payment. This is the only
//               thing that unlocks a plan: the owner's browser coming back "successful", or a
//               webhook, only prompt the app to ask.

import crypto from 'crypto';
import { config } from '../config';

export class PaystackError extends Error {}

export const paystackConfigured = () => config.paystack.secretKey.length > 0;

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (!paystackConfigured()) throw new PaystackError('Paystack is not set up (PAYSTACK_SECRET_KEY is empty)');
  let res: Response;
  try {
    res = await fetch(`${config.paystack.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${config.paystack.secretKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new PaystackError(`Couldn't reach Paystack: ${err instanceof Error ? err.message : String(err)}`);
  }
  const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !json?.status || json.data === undefined) {
    throw new PaystackError(`Paystack ${method} ${path.split('?')[0]} failed (${res.status}): ${json?.message ?? 'no details'}`);
  }
  return json.data;
}

export interface InitializeResult { authorization_url: string; access_code: string; reference: string }

export function initializeTransaction(input: {
  email: string; amountKobo: number; reference: string; callbackUrl: string; metadata: Record<string, unknown>;
}): Promise<InitializeResult> {
  return call<InitializeResult>('POST', '/transaction/initialize', {
    email: input.email,
    amount: input.amountKobo,
    currency: 'NGN',
    reference: input.reference,
    callback_url: input.callbackUrl,
    channels: ['bank_transfer', 'card', 'ussd'],
    metadata: input.metadata,
  });
}

export interface VerifiedTransaction {
  /** 'success' is the only state that means the money arrived. */
  status: 'success' | 'failed' | 'abandoned' | 'ongoing' | 'pending' | 'processing' | 'queued' | 'reversed' | string;
  reference: string;
  amount: number;
  currency: string;
  channel: string | null;
  paid_at: string | null;
}

export function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  return call<VerifiedTransaction>('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
}

/**
 * Paystack signs each webhook with an HMAC-SHA512 of the exact request body, keyed with the
 * secret key, in the x-paystack-signature header. Compared in constant time.
 */
export function validWebhookSignature(rawBody: Buffer, signature: unknown): boolean {
  if (!paystackConfigured() || typeof signature !== 'string' || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha512', config.paystack.secretKey).update(rawBody).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
