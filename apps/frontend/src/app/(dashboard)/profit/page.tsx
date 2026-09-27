'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, CaretLeft, CaretRight, Lightbulb } from '@phosphor-icons/react';
import { useShopsStore } from '@/store/shops';
import { useProfit } from '@/hooks/useProfit';
import PageWrapper from '@/components/layout/PageWrapper';
import { Skeleton } from '@/components/ui/Skeleton';
import StaffSection from '@/components/profit/StaffSection';
import { errorMessage } from '@/lib/errors';
import { isDemoShop } from '@/lib/demo';
import { cn, formatShortDate, formatWhole as wholeMoney, todayInLagos } from '@/lib/utils';
import type { Insight, MonthlyProfit } from '@/types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthTitle = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
function stepMonth(m: string, by: number): string {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

export default function ProfitPage() {
  const shop = useShopsStore((s) => s.activeShop());
  const shopId = shop?.id ?? '';
  const thisMonth = todayInLagos().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const { data, isLoading, error, isPlaceholderData } = useProfit(shopId, month === thisMonth ? undefined : month);

  return (
    <PageWrapper title="Profit">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Month: back through past months, never into ones that haven't started. */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button" aria-label="Previous month" onClick={() => setMonth(stepMonth(month, -1))}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 transition hover:bg-white/[0.06] hover:text-white active:bg-white/[0.1]"
          >
            <CaretLeft size={18} weight="bold" />
          </button>
          <div className="text-center">
            <p className="text-[16px] font-semibold text-white/90">{monthTitle(month)}</p>
            <p className="text-[13px] text-white/40">
              {data && !isPlaceholderData
                ? data.inProgress ? `1–${formatShortDate(data.to)} so far` : 'The whole month'
                : ' '}
            </p>
          </div>
          <button
            type="button" aria-label="Next month" onClick={() => setMonth(stepMonth(month, 1))} disabled={month >= thisMonth}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 transition hover:bg-white/[0.06] hover:text-white active:bg-white/[0.1] disabled:pointer-events-none disabled:opacity-20"
          >
            <CaretRight size={18} weight="bold" />
          </button>
        </div>

        {isDemoShop(shopId) ? (
          <p className="glass-card rounded-2xl p-5 text-[14px] text-white/55">Profit is worked out from your real records. Sign in to your own shop to see it.</p>
        ) : isLoading ? (
          <div className="space-y-4" role="status" aria-label="Loading">
            <Skeleton className="h-[132px] rounded-2xl" />
            <Skeleton className="h-[180px] rounded-2xl" />
          </div>
        ) : error ? (
          <p className="text-sm text-white/60" role="alert">{errorMessage(error, "Couldn't work out your profit. Try again.")}</p>
        ) : data && (
          <div className={cn('space-y-4 transition-opacity', isPlaceholderData && 'opacity-50')}>
            <Headline p={data} currency={shop?.currency} />
            {data.insights.length > 0 && <Feedback insights={data.insights} />}
            <Breakdown p={data} currency={shop?.currency} />
          </div>
        )}

        {!isDemoShop(shopId) && <StaffSection shopId={shopId} currency={shop?.currency} />}
      </div>
    </PageWrapper>
  );
}

function Headline({ p, currency }: { p: MonthlyProfit; currency?: string }) {
  const loss = p.profit < 0;
  const label = `${loss ? 'Loss' : 'Profit'}${p.inProgress ? ' so far' : ''}`;
  return (
    <section className="glass-card rounded-2xl p-5">
      <p className="text-[13px] font-medium text-white/45">{label}</p>
      <p className="mt-1 text-[34px] font-bold leading-tight tracking-tight tabular-nums text-white/95">
        {loss && '−'}{wholeMoney(Math.abs(p.profit), currency)}
      </p>
      <p className="mt-1 text-[14px] text-white/50">
        {p.method === 'sold' ? 'On what you sold, after running costs' : p.stockBought > 0 ? 'Sales minus everything you spent' : 'Sales minus running costs'}
      </p>
    </section>
  );
}

const TONE_ICON = { good: ArrowUpRight, bad: ArrowDownRight, neutral: Lightbulb } as const;

function Feedback({ insights }: { insights: Insight[] }) {
  return (
    <section className="glass-card rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-white/75">How it&apos;s going</h2>
      <ul className="mt-3 space-y-3">
        {insights.map((i) => {
          const Icon = TONE_ICON[i.tone];
          return (
            <li key={i.kind} className="flex gap-3">
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  i.tone === 'neutral' ? 'bg-white/[0.06] text-white/50' : 'bg-white/[0.1] text-white/85',
                )}
                aria-label={i.tone === 'good' ? 'Good' : i.tone === 'bad' ? 'Watch this' : 'Note'}
              >
                <Icon size={13} weight="bold" />
              </span>
              <p className="text-[15px] leading-snug text-white/80 sm:text-[14px]">{i.text}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Breakdown({ p, currency }: { p: MonthlyProfit; currency?: string }) {
  const money = (n: number) => wholeMoney(n, currency);
  const bySold = p.method === 'sold';
  const max = Math.max(...p.running.map((l) => l.total), 1);
  return (
    <section className="glass-card rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-white/75">How it&apos;s worked out</h2>
      <div className="mt-3 space-y-2.5 text-[15px] sm:text-[14px]">
        <Row label="Sales" value={money(p.sales)} note={p.salesCount ? `${p.salesCount} ${p.salesCount === 1 ? 'sale' : 'sales'}, including on credit` : undefined} />
        {bySold && p.costOfGoodsSold !== null && (
          <Row
            label="Cost of the goods sold" value={`− ${money(p.costOfGoodsSold)}`}
            note={p.coverage !== null && p.coverage < 1 ? `Estimated for the ${Math.round((1 - p.coverage) * 100)}% of sales with no cost price` : 'From your products’ cost prices'}
          />
        )}
        {!bySold && p.stockBought > 0 && <Row label="Stock bought" value={`− ${money(p.stockBought)}`} />}
        <Row label="Running costs" value={`− ${money(p.runningCosts)}`} />
        {p.running.length > 0 && (
          <ul className="space-y-2 pb-1 pl-3" aria-label="Running costs by kind">
            {p.running.map((l) => (
              <li key={l.category}>
                <div className="flex items-baseline justify-between gap-3 text-[14px] sm:text-[13px]">
                  <span className="min-w-0 truncate text-white/55">{l.category}</span>
                  <span className="shrink-0 tabular-nums text-white/65">{money(l.total)}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-white/[0.05]">
                  <div className="h-1 rounded-full bg-white/30" style={{ width: `${Math.max((l.total / max) * 100, 2)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.08] pt-2.5">
          <span className="font-semibold text-white/90">{p.profit < 0 ? 'Loss' : 'Profit'}</span>
          <span className="font-semibold tabular-nums text-white/90">{p.profit < 0 && '−'}{money(Math.abs(p.profit))}</span>
        </div>
        {bySold && p.stockBought > 0 && (
          <p className="text-[13px] text-white/40">Stock bought this month: {money(p.stockBought)}. It isn&apos;t a cost until it&apos;s sold.</p>
        )}
      </div>
      {p.methodNote && <p className="mt-3 text-[13px] leading-relaxed text-white/45">{p.methodNote}</p>}
      <p className="mt-3 text-[13px] leading-relaxed text-white/40">
        Something counted in the wrong place? In <Link href="/transactions" className="text-white/60 underline underline-offset-2 hover:text-white/85">Transactions</Link>, tap
        {' '}&ldquo;Running cost&rdquo; or &ldquo;Stock&rdquo; on the expense to change it.
      </p>
    </section>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-white/70">{label}</span>
        <span className="shrink-0 tabular-nums text-white/85">{value}</span>
      </div>
      {note && <p className="text-[13px] text-white/35">{note}</p>}
    </div>
  );
}
