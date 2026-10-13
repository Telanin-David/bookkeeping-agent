import crypto from 'crypto';
import * as P from './plans';
import { config } from '../config';

const at = (iso: string) => new Date(iso);
const period = (id: string, plan: P.Period['plan'], start: string, end: string): P.Period =>
  ({ id, plan, startsAt: at(start), endsAt: at(end) });

const NOW = at('2026-10-13T10:00:00Z');

describe('plans', () => {
  it('prices and caps match the pricing plan', () => {
    expect(P.PAID_PLANS.monthly).toMatchObject({ priceKobo: 500_000, hours: 30 * 24, chat: { perDay: 6 }, pass: false });
    expect(P.PAID_PLANS.yearly).toMatchObject({ priceKobo: 5_000_000, hours: 365 * 24, chat: { perDay: 6 }, pass: false });
    expect(P.PAID_PLANS.weekly).toMatchObject({ priceKobo: 300_000, hours: 7 * 24, chat: { perDay: 20 }, pass: true });
    expect(P.PAID_PLANS.day).toMatchObject({ priceKobo: 80_000, hours: 24, chat: { perPeriod: 20 }, pass: true });
    expect(P.trialRule()).toEqual({ hours: 14 * 24, messages: 40 });
  });

  it('every plan still leaves a margin when an owner uses all of it', () => {
    // ≈$0.01 a message at ₦1,600 (the pricing documents), plus Paystack's fee with VAT.
    const perMessageKobo = 1_600;
    const fee = (k: number) => Math.round(Math.min(0.015 * k + (k > 250_000 ? 10_000 : 0), 200_000) * 1.075);
    for (const plan of Object.values(P.PAID_PLANS)) {
      const days = plan.hours / 24;
      const maxMessages = 'perDay' in plan.chat ? plan.chat.perDay * Math.min(days, days === 30 ? 26 : days === 365 ? 312 : days) : plan.chat.perPeriod;
      const margin = plan.priceKobo - fee(plan.priceKobo) - maxMessages * perMessageKobo;
      expect({ plan: plan.id, positive: margin > 0 }).toEqual({ plan: plan.id, positive: true });
    }
  });

  it('free has no assistant and one shop; paid and trial have everything with up to 3 shops', () => {
    expect(P.featuresFor('free')).toEqual(P.FREE_FEATURES);
    expect(P.featuresFor('free').assistant).toBe(false);
    expect(P.featuresFor('trial')).toEqual(P.PAID_FEATURES);
    expect(P.featuresFor('monthly').maxShops).toBe(3);
    expect(P.featuresFor('unlimited').maxShops).toBeNull();
  });

  describe('when paid time starts', () => {
    it('starts now when nothing of the same kind is running', () => {
      expect(P.nextPeriod('monthly', [], NOW)).toEqual({ startsAt: NOW, endsAt: at('2026-11-12T10:00:00Z') });
    });

    it('ignores the trial: paying during the trial starts the plan now', () => {
      const trial = period('t', 'trial', '2026-10-10T00:00:00Z', '2026-10-24T00:00:00Z');
      expect(P.nextPeriod('monthly', [trial], NOW).startsAt).toEqual(NOW);
    });

    it('adds on at the end when renewing early, so no days are lost', () => {
      const monthly = period('m', 'monthly', '2026-10-01T00:00:00Z', '2026-10-31T00:00:00Z');
      expect(P.nextPeriod('monthly', [monthly], NOW)).toEqual({ startsAt: at('2026-10-31T00:00:00Z'), endsAt: at('2026-11-30T00:00:00Z') });
      // Yearly is the same kind of plan: it follows on too.
      expect(P.nextPeriod('yearly', [monthly], NOW).startsAt).toEqual(at('2026-10-31T00:00:00Z'));
    });

    it('follows the last of several paid in advance', () => {
      const a = period('a', 'monthly', '2026-10-01T00:00:00Z', '2026-10-31T00:00:00Z');
      const b = period('b', 'monthly', '2026-10-31T00:00:00Z', '2026-11-30T00:00:00Z');
      expect(P.nextPeriod('monthly', [a, b], NOW).startsAt).toEqual(at('2026-11-30T00:00:00Z'));
    });

    it('a pass bought during Monthly starts now, as a top-up', () => {
      const monthly = period('m', 'monthly', '2026-10-01T00:00:00Z', '2026-10-31T00:00:00Z');
      expect(P.nextPeriod('day', [monthly], NOW)).toEqual({ startsAt: NOW, endsAt: at('2026-10-14T10:00:00Z') });
    });

    it('an expired plan does not delay a new one', () => {
      const old = period('o', 'monthly', '2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z');
      expect(P.nextPeriod('monthly', [old], NOW).startsAt).toEqual(NOW);
    });
  });

  describe('which plan applies now', () => {
    const trial = period('t', 'trial', '2026-10-01T00:00:00Z', '2026-10-15T00:00:00Z');
    const monthly = period('m', 'monthly', '2026-10-05T00:00:00Z', '2026-11-04T00:00:00Z');
    const day = period('d', 'day', '2026-10-13T08:00:00Z', '2026-10-14T08:00:00Z');

    it('nothing running is the free plan', () => {
      expect(P.activePeriod([], NOW)).toBeNull();
      expect(P.activePeriod([period('x', 'monthly', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z')], NOW)).toBeNull();
    });

    it('a paid plan outranks the trial, and a pass outranks Monthly while it lasts', () => {
      expect(P.activePeriod([trial], NOW)?.id).toBe('t');
      expect(P.activePeriod([trial, monthly], NOW)?.id).toBe('m');
      expect(P.activePeriod([trial, monthly, day], NOW)?.id).toBe('d');
      expect(P.activePeriod([trial, monthly, day], at('2026-10-14T09:00:00Z'))?.id).toBe('m');
    });

    it('a period starts exactly on time and ends exactly on time', () => {
      expect(P.activePeriod([day], at('2026-10-13T08:00:00Z'))?.id).toBe('d');
      expect(P.activePeriod([day], at('2026-10-14T08:00:00Z'))).toBeNull();
    });

    it('"until" follows on through time paid in advance', () => {
      const next = period('n', 'monthly', '2026-11-04T00:00:00Z', '2026-12-04T00:00:00Z');
      expect(P.coveredUntil(monthly, [monthly, next])).toEqual(at('2026-12-04T00:00:00Z'));
      expect(P.coveredUntil(monthly, [monthly])).toEqual(at('2026-11-04T00:00:00Z'));
      expect(P.queuedPeriods([monthly, next], NOW).map((p) => p.id)).toEqual(['n']);
    });
  });

  it('message rules: trial and day pass count over the whole period, the rest per day', () => {
    expect(P.chatRule('trial')).toEqual({ perPeriod: 40 });
    expect(P.chatRule('day')).toEqual({ perPeriod: 20 });
    expect(P.chatRule('monthly')).toEqual({ perDay: 6 });
    expect(P.chatRule('weekly')).toEqual({ perDay: 20 });
  });

  it('writes naira from kobo', () => {
    expect(P.nairaText(500_000)).toBe('₦5,000');
    expect(P.nairaText(5_000_000)).toBe('₦50,000');
  });
});

describe('Paystack webhook signature', () => {
  const original = config.paystack.secretKey;
  afterEach(() => { config.paystack.secretKey = original; });

  it('accepts only an HMAC-SHA512 of the exact body with the secret key', async () => {
    const { validWebhookSignature } = await import('./paystack');
    config.paystack.secretKey = 'sk_test_abc';
    const body = Buffer.from('{"event":"charge.success","data":{"reference":"bk_x"}}');
    const good = crypto.createHmac('sha512', 'sk_test_abc').update(body).digest('hex');
    expect(validWebhookSignature(body, good)).toBe(true);
    expect(validWebhookSignature(Buffer.from(body.toString() + ' '), good)).toBe(false);
    expect(validWebhookSignature(body, crypto.createHmac('sha512', 'other').update(body).digest('hex'))).toBe(false);
    expect(validWebhookSignature(body, undefined)).toBe(false);
    expect(validWebhookSignature(body, 'abc')).toBe(false);
    config.paystack.secretKey = '';
    expect(validWebhookSignature(body, good)).toBe(false);
  });
});

describe('refusals', () => {
  it('explains each kind of limit in plain words', async () => {
    const { chatRefusal } = await import('./billing');
    const base = { billingEnabled: true, endsAt: null, upcoming: [], trial: null, features: P.PAID_FEATURES, passesEnabled: false, planName: '' };
    const free = chatRefusal({ ...base, plan: 'free', features: P.FREE_FEATURES, chat: { used: 0, limit: 0, remaining: 0, scope: 'none', resetsAt: null } });
    expect([free.statusCode, free.code]).toEqual([402, 'PLAN_REQUIRED']);
    expect(free.message).toMatch(/paid plan.*Add transaction form/);
    const trial = chatRefusal({ ...base, plan: 'trial', chat: { used: 40, limit: 40, remaining: 0, scope: 'period', resetsAt: null } });
    expect([trial.statusCode, trial.message]).toEqual([402, expect.stringMatching(/40 assistant messages that come with the free trial/)]);
    const day = chatRefusal({ ...base, plan: 'day', chat: { used: 20, limit: 20, remaining: 0, scope: 'period', resetsAt: null } });
    expect([day.statusCode, day.message]).toEqual([429, expect.stringMatching(/20 messages on your day pass/)]);
    const monthly = chatRefusal({ ...base, plan: 'monthly', chat: { used: 6, limit: 6, remaining: 0, scope: 'day', resetsAt: null } });
    expect([monthly.statusCode, monthly.message]).toEqual([429, expect.stringMatching(/today's 6 messages.*midnight/)]);
  });
});
