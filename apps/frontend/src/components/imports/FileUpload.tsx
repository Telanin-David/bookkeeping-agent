'use client';
import { useCallback, useEffect, useState } from 'react';
import { UploadSimple } from '@phosphor-icons/react';
import { importsApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useShopsStore } from '@/store/shops';
import { useImportsStore } from '@/store/imports';
import Button from '@/components/ui/Button';
import type { ImportPreview } from '@/types';

interface FileUploadProps {
  onUploaded: (preview: ImportPreview) => void;
}

export default function FileUpload({ onUploaded }: FileUploadProps) {
  const activeShop = useShopsStore((s) => s.activeShop());
  const [dragging, setDragging] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function uploadFile(file: File) {
    if (!activeShop) { setError('Select a shop first.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('The file is larger than 5 MB. Split it into smaller files.'); return; }
    setLoading(true);
    setError('');
    try {
      onUploaded(await importsApi.upload(activeShop.id, file));
    } catch (err) {
      // The server explains unreadable files (old .xls, no header row…) in plain words.
      setError(errorMessage(err, "Couldn't upload the file. Check your connection and try again."));
    } finally {
      setLoading(false);
    }
  }

  // A file picked from the chat's + menu is handed over through the store; read it once.
  useEffect(() => {
    const { pendingFile, setPendingFile } = useImportsStore.getState();
    if (!pendingFile) return;
    setPendingFile(null);
    uploadFile(pendingFile);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShop]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
        dragging
          ? 'border-white/25 bg-white/[0.04]'
          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.03]'
      }`}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl glass">
        <UploadSimple size={22} className="text-white/45" />
      </div>
      <p className="mb-1 text-sm font-medium text-white/75">Choose your spreadsheet</p>
      <p className="mb-4 text-xs text-white/35">Excel (.xlsx) or CSV, up to 5 MB. The first sheet is read.</p>
      <label>
        <input
          id="import-file"
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadFile(f); }}
        />
        <Button variant="secondary" loading={loading} onClick={() => document.getElementById('import-file')?.click()}>
          {loading ? 'Reading…' : 'Choose file'}
        </Button>
      </label>
      {error && <p className="mt-3 max-w-sm text-[13px] text-white/70" role="alert">{error}</p>}
    </div>
  );
}
