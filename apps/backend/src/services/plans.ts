// What each plan costs and includes, and the rules for when a payment's time starts and
// which plan applies at a given moment. No database here, so the rules can be tested alone.
//
// Plans (prices in kobo, as Paystack takes them):
//   free     no assistant, one shop, receipts carry a "Made with sabeebook" line
//   trial    everything Monthly has, for TRIAL_DAYS, with TRIAL_MESSAGES assistant messages in all
//   monthly  ₦5,000 for 30 days, 6 assistant messages a day
//   yearly   ₦50,000 for 365 days, the same as Monthly (two months free)
//   weekly   ₦3,000 for 7 days, 20 messages a day  ┐ "full capacity" passes, offered only
//   day      ₦800 for 24 hours, 20 messages        ┘ once the admin switches them on
//
// Every plan's message cap is set so that an owner who uses all of it still leaves a margin
// after the AI bill and Paystack's fee (see the pricing documents). Receipts and reports use
// no AI, so they are never metered.

import { config } from '../config';

export type PaidPlanId = 'monthly' | 'yearly' | 'weekly' | 'day';
/** 'unlimited': billing is switched off, or the account is an admin. */
export type PlanId = PaidPlanId | 'trial' | 'free' | 'unlimited';
export type Family = 'subscription' | 'pass';

export interface Features {
  assistant: boolean;
  /** Profit & Loss, credit and stock PDFs. Receipts are always available. */
  reports: boolean;
  /** The shop's logo and signature on receipts, without the "Made with sabeebook" line. */
  branding: boolean;
  emailAlerts: boolean;
  /** Adding staff and paying salaries. Existing staff stay visible either way. */
  staff: boolean;
  import: boolean;
  /** null: no limit. */
  maxShops: number | null;
}

export type Feature = Exclude<keyof Features, 'maxShops'>;

export const FREE_FEATURES: Features = {
  assistant: false, reports: false, branding: false, emailAlerts: false, staff: false, import: false, maxShops: 1,
};
export const PAID_FEATURES: Features = {
  assistant: true, reports: true, branding: true, emailAlerts: true, staff: true, import: true, maxShops: 3,
};
export const UNLIMITED_FEATURES: Features = { ...PAID_FEATURES, maxShops: null };

export type ChatRule = { perDay: number } | { perPeriod: number };

export interface PlanDef {
  id: PaidPlanId;
  name: string;
  priceKobo: number;
  hours: number;
  chat: ChatRule;
  family: Family;
  /** Shown only once the admin switches the full-capacity passes on. */
  pass: boolean;
  /** One line for the plan's card. */
  summary: string;
}

const DAY = 24;

export const PAID_PLANS: Record<PaidPlanId, PlanDef> = {
  monthly: {
    id: 'monthly', name: 'Monthly', priceKobo: 500_000, hours: 30 * DAY, chat: { perDay: 6 }, family: 'subscription', pass: false,
    summary: '6 assistant messages a day, reports, receipts with your logo, email alerts, staff, import, up to 3 shops.',
  },
  yearly: {
    id: 'yearly', name: 'Yearly', priceKobo: 5_000_000, hours: 365 * DAY, chat: { perDay: 6 }, family: 'subscription', pass: false,
    summary: 'Everything in Monthly for a year: two months free.',
  },
  weekly: {
    id: 'weekly', name: 'Full capacity: 1 week', priceKobo: 300_000, hours: 7 * DAY, chat: { perDay: 20 }, family: 'pass', pass: true,
    summary: '20 assistant messages a day for 7 days, and everything in Monthly.',
  },
  day: {
    id: 'day', name: 'Full capacity: 1 day', priceKobo: 80_000, hours: DAY, chat: { perPeriod: 20 }, family: 'pass', pass: true,
    summary: '20 assistant messages over the next 24 hours, and everything in Monthly.',
  },
};

export const PAID_PLAN_IDS = Object.keys(PAID_PLANS) as PaidPlanId[];
export const isPaidPlan = (v: unknown): v is PaidPlanId => typeof v === 'string' && v in PAID_PLANS;

export function trialRule(): { hours: number; messages: number } {
  return { hours: config.billing.trialDays * DAY, messages: config.billing.trialMessages };
}

export function planName(plan: PlanId): string {
  if (plan === 'trial') return 'Free trial';
  if (plan === 'free') return 'Free';
  if (plan === 'unlimited') return 'Everything included';
  return PAID_PLANS[plan].name;
}

/** Higher wins when two periods overlap: a pass bought during Monthly gives its bigger allowance. */
function rank(plan: PaidPlanId | 'trial'): number {
  if (plan === 'trial') return 1;
  return PAID_PLANS[plan].family === 'pass' ? 3 : 2;
}

export interface Period {
  id: string;
  plan: PaidPlanId | 'trial';
  startsAt: Date;
  endsAt: Date;
}

const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);

/**
 * When a newly paid plan's time runs. Paying again for the same kind of plan before it runs
 * out adds the time on at the end, so no days are lost (Monthly then Yearly, or a week pass
 * then a day pass). A pass bought during Monthly or Yearly starts now, as a top-up: its bigger
 * allowance applies while it lasts, then the subscription carries on as before.
 */
export function nextPeriod(plan: PaidPlanId, existing: Period[], now: Date): { startsAt: Date; endsAt: Date } {
  const family = PAID_PLANS[plan].family;
  const sameFamilyEnds = existing
    .filter((p) => p.plan !== 'trial' && PAID_PLANS[p.plan].family === family && p.endsAt > now)
    .map((p) => p.endsAt.getTime());
  const startsAt = sameFamilyEnds.length ? new Date(Math.max(...sameFamilyEnds)) : now;
  return { startsAt, endsAt: addHours(startsAt, PAID_PLANS[plan].hours) };
}

/** The period in force at `now`: of those covering it, the highest-ranked, then the one ending last. */
export function activePeriod(periods: Period[], now: Date): Period | null {
  const covering = periods.filter((p) => p.startsAt <= now && now < p.endsAt);
  covering.sort((a, b) => rank(b.plan) - rank(a.plan) || b.endsAt.getTime() - a.endsAt.getTime());
  return covering[0] ?? null;
}

/**
 * How long the active plan's kind of cover lasts, following on through periods of the same
 * family paid in advance: Monthly with another Monthly queued is "until" the second one's end.
 */
export function coveredUntil(active: Period, periods: Period[]): Date {
  if (active.plan === 'trial') return active.endsAt;
  const family = PAID_PLANS[active.plan].family;
  const same = periods
    .filter((p) => p.plan !== 'trial' && PAID_PLANS[p.plan].family === family)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  let end = active.endsAt;
  for (const p of same) {
    if (p.startsAt <= end && p.endsAt > end) end = p.endsAt;
  }
  return end;
}

/** Paid time that starts later (bought in advance), soonest first. */
export function queuedPeriods(periods: Period[], now: Date): Period[] {
  return periods.filter((p) => p.startsAt > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function chatRule(plan: PaidPlanId | 'trial'): ChatRule {
  return plan === 'trial' ? { perPeriod: trialRule().messages } : PAID_PLANS[plan].chat;
}

export function featuresFor(plan: PlanId): Features {
  if (plan === 'unlimited') return UNLIMITED_FEATURES;
  if (plan === 'free') return FREE_FEATURES;
  return PAID_FEATURES;
}

/** Why a feature is locked, in the owner's words, with what they can do instead. */
export const LOCKED_MESSAGES: Record<Feature | 'shops', string> = {
  assistant: 'The assistant is part of the paid plan. You can still record everything with the Add transaction form.',
  reports: 'PDF reports are part of the paid plan. Your profit is always on the Profit page.',
  branding: 'Receipts with your logo and signature are part of the paid plan.',
  emailAlerts: 'Alert emails are part of the paid plan. You still see every alert in the app.',
  staff: 'Staff and salaries are part of the paid plan.',
  import: 'Importing from a spreadsheet is part of the paid plan.',
  shops: 'Your plan has reached its number of shops. The paid plan allows up to 3.',
};

/** ₦5,000 from 500,000 kobo. */
export function nairaText(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;
}
