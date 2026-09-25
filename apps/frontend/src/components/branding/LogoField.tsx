'use client';
import { useRef, useState, type ChangeEvent } from 'react';
import { ImageSquare } from '@phosphor-icons/react';
import { toPrintableImage } from '@/lib/branding';

interface LogoFieldProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

export default function LogoField({ value, onChange }: LogoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      onChange(await toPrintableImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />

      {value ? (
        <div className="flex items-center gap-4 rounded-2xl glass-card p-4">
          <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-[#fbfbfa] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Your logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:max-w-[220px]">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="h-10 rounded-full bg-white/[0.08] px-4 text-[14px] font-medium text-white/85 ring-1 ring-inset ring-white/[0.10] transition hover:bg-white/[0.12]"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="h-10 rounded-full px-4 text-[14px] text-white/45 transition hover:bg-white/[0.05] hover:text-white/75"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-9 transition hover:border-white/25 hover:bg-white/[0.04] disabled:opacity-50"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.07] ring-1 ring-inset ring-white/[0.10]">
            <ImageSquare size={22} className="text-white/65" />
          </span>
          <span className="text-[15px] font-medium text-white/80">{busy ? 'Preparing…' : 'Upload your logo'}</span>
          <span className="text-[13px] text-white/35">PNG or JPG · up to 5 MB</span>
        </button>
      )}

      {error && <p className="mt-2 text-[13px] text-white/55">{error}</p>}
    </div>
  );
}
