'use client';
import { useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { usePayments, useRecordPayment, useRemovePayment, useTransaction } from '@/hooks/useTransactions';
import { formatCurrency, formatDate, todayInLagos, cn } from '@/lib/utils';
import type { Transaction } from '@/types';

interface PaymentModalProps {
  shopId: string;
  /** The debt being paid; null keeps the modal closed. */
  tx: Transaction | null;
  onClose: () => void;
}

/** The server explains refusals in plain words ("That's more than is still owed…"); show them as-is. */
function errorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status ?? 0;
    const message: unknown = err.response?.data?.message;
    if (status >= 400 && status < 500 && typeof message === 'string') return message;
    return "Couldn't save that. Check your connection and try again.";
  }
  return err instanceof Error ? err.message : "Couldn't save that. Try again.";
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3.5 py-2">
      <span className="text-[13px] text-white/45">{label}</span>
      <span className={cn('text-right text-[14px] tabular-nums', strong ? 'font-semibold text-white/95' : 'text-white/75')}>{value}</span>
    </div>
  );
}

function PaymentForm({ shopId, tx: initial, onClose }: { shopId: string; tx: Transaction; onClose: () => void }) {
  // Re-read the debt so the figures follow each payment or undo.
  const { data: fresh } = useTransaction(shopId, initial.id);
  const tx = fresh ?? initial;
  const { data: payments = [] } = usePayments(shopId, tx.id);
  const record = useRecordPayment(shopId);
  const remove = useRemovePayment(shopId);

  const today = todayInLagos();
  const debtDay = tx.date.slice(0, 10);
  const [amount, setAmount] = useState(String(tx.balance));
  const [paidOn, setPaidOn] = useState(today);
  const [error, setError] = useState('');

  const isCreditSale = tx.type === 'receivable';
  const settled = tx.balance <= 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('Enter how much was paid.');
    if (Math.round(value * 100) > Math.round(tx.balance * 100)) {
      return setError(`That’s more than is still owed. The most you can record is ${formatCurrency(tx.balance, tx.currency)}.`);
    }
    if (!paidOn || paidOn > today) return setError('The payment date can’t be in the future.');
    if (paidOn < debtDay) return setError(`The payment can’t be dated before the ${isCreditSale ? 'sale' : 'bill'} (${formatDate(debtDay)}).`);
    try {
      await record.mutateAsync({ txId: tx.id, amount: value, paidOn });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function undo(paymentId: string) {
    setError('');
    try {
      const updated = await remove.mutateAsync({ txId: tx.id, paymentId });
      setAmount(String(updated.balance));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[15px] text-white/90">{tx.counterparty ?? (isCreditSale ? 'Customer' : 'Supplier')}</p>
        <p className="text-[13px] text-white/45">{[tx.description, formatDate(tx.date)].filter(Boolean).join(' · ')}</p>
      </div>

      <div className="divide-y divide-white/[0.06] rounded-xl bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]">
        <Figure label={isCreditSale ? 'Owed' : 'You owe'} value={formatCurrency(tx.amount, tx.currency)} />
        <Figure label="Paid" value={formatCurrency(tx.amountPaid, tx.currency)} />
        <Figure label="Still owed" value={formatCurrency(tx.balance, tx.currency)} strong />
      </div>

      {payments.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-white/40">Payments so far</p>
          <ul className="divide-y divide-white/[0.06] rounded-xl ring-1 ring-inset ring-white/[0.06]">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-[13px] text-white/60">{formatDate(p.paidOn)}</span>
                <span className="ml-auto text-[13px] tabular-nums text-white/85">{formatCurrency(p.amount, tx.currency)}</span>
                <button
                  type="button"
                  onClick={() => undo(p.id)}
                  disabled={remove.isPending}
                  className="text-[12px] text-white/45 underline-offset-2 hover:text-white/80 hover:underline disabled:opacity-40"
                >
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {settled ? (
        <>
          <p className="text-[13px] text-white/60">This {isCreditSale ? 'credit sale' : 'bill'} is fully paid.</p>
          {error && <p className="text-[13px] text-white/60">{error}</p>}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="payment-amount"
              label="Amount paid"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              max={tx.balance}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(''); }}
            />
            <Input
              id="payment-date"
              label="Paid on"
              type="date"
              min={debtDay}
              max={today}
              value={paidOn}
              onChange={(e) => { setPaidOn(e.target.value); setError(''); }}
            />
          </div>
          <p className="text-xs text-white/30">
            Paying less than {formatCurrency(tx.balance, tx.currency)} leaves the rest as still owed.
          </p>
          {error && <p className="text-[13px] text-white/70" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={record.isPending}>Save payment</Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function PaymentModal({ shopId, tx, onClose }: PaymentModalProps) {
  return (
    <Modal open={!!tx} onClose={onClose} title={tx?.type === 'payable' ? 'Payment to supplier' : 'Payment from customer'}>
      {/* Keyed by debt so the form starts fresh for each one. */}
      {tx && <PaymentForm key={tx.id} shopId={shopId} tx={tx} onClose={onClose} />}
    </Modal>
  );
}
