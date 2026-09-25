'use client';
import { useState } from 'react';
import PageWrapper from '@/components/layout/PageWrapper';
import ReportForm from '@/components/reports/ReportForm';
import ReceiptPicker from '@/components/receipts/ReceiptPicker';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'reports',  label: 'Reports' },
  { id: 'receipts', label: 'Receipts' },
] as const;

type Tab = (typeof TABS)[number]['id'];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('reports');

  return (
    <PageWrapper title="Reports">
      <div className="max-w-xl">
        <div className="mb-6 inline-flex rounded-full glass p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'h-9 rounded-full px-5 text-[14px] font-medium transition',
                tab === t.id ? 'bg-white/[0.12] text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]' : 'text-white/50 hover:text-white/80',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'reports' ? (
          <>
            <p className="mb-5 text-[14px] text-white/45">
              Generate a PDF report for your shop. Pick a report type and date range, then download.
            </p>
            <ReportForm />
          </>
        ) : (
          <>
            <p className="mb-5 text-[14px] text-white/45">
              Pick a sale to view and print its receipt. You can also ask the agent in chat, e.g. &ldquo;receipt for Mama Nkechi&rdquo;.
            </p>
            <ReceiptPicker />
          </>
        )}
      </div>
    </PageWrapper>
  );
}
