'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { count, shortDay, usd } from '@/lib/admin';

interface DailyCostChartProps {
  daily: { day: string; messages: number; cost: number }[];
}

/** AI spending per day: one bar a day, hover or tap a bar for its numbers, or read it as a table. */
export default function DailyCostChart({ daily }: DailyCostChartProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(...daily.map((d) => d.cost), 0);
  const shown = picked ?? daily.length - 1;
  const point = daily[shown];

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white/75">AI spending per day</p>
          {point && (
            <p className="mt-1 text-[13px] tabular-nums text-white/50" aria-live="polite">
              {shortDay(point.day)} · {count(point.messages)} {point.messages === 1 ? 'message' : 'messages'} · {usd(point.cost)}
            </p>
          )}
        </div>
        <button type="button" onClick={() => setAsTable((v) => !v)} className="shrink-0 text-[13px] text-white/45 underline-offset-2 hover:text-white/80 hover:underline">
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-white/40"><th className="py-1.5 font-medium">Day</th><th className="py-1.5 text-right font-medium">Messages</th><th className="py-1.5 text-right font-medium">Spent</th></tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((d) => (
                <tr key={d.day} className="border-t border-white/[0.05] text-white/70">
                  <td className="py-1.5">{shortDay(d.day)}</td>
                  <td className="py-1.5 text-right tabular-nums">{d.messages}</td>
                  <td className="py-1.5 text-right tabular-nums">{usd(d.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="relative h-40">
            {/* Recessive guide at the tallest day, labelled once. */}
            {max > 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-white/[0.08]">
                <span className="absolute -top-2.5 right-0 bg-ink-900/80 pl-1 text-[11px] tabular-nums text-white/35">{usd(max)}</span>
              </div>
            )}
            <div className="absolute inset-0 flex items-end gap-[2px] border-b border-white/[0.12]" onMouseLeave={() => setPicked(null)}>
              {daily.map((d, i) => (
                <button
                  key={d.day}
                  type="button"
                  aria-label={`${shortDay(d.day)}: ${d.messages} messages, ${usd(d.cost)}`}
                  onMouseEnter={() => setPicked(i)}
                  onFocus={() => setPicked(i)}
                  onClick={() => setPicked(i)}
                  className="group flex h-full min-w-0 flex-1 items-end outline-none"
                >
                  <span
                    className={cn(
                      'block w-full rounded-t-[4px] transition-colors',
                      i === shown ? 'bg-white/80' : 'bg-white/35 group-hover:bg-white/60',
                      d.cost === 0 && 'bg-transparent',
                    )}
                    style={{ height: max > 0 && d.cost > 0 ? `${Math.max((d.cost / max) * 100, 2)}%` : 0 }}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-white/35">
            <span>{daily[0] && shortDay(daily[0].day)}</span>
            <span>Today</span>
          </div>
        </>
      )}
    </div>
  );
}
